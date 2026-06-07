import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { RequestContext } from '../../common/request-context';
import type { Env } from '../../config/env.schema';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashTokenForDb,
  parseDurationToFutureDate,
  parseDurationToSeconds,
} from './auth-tokens.util';
import type { AuthTokenPair, TenantJwtPayload, TenantRefreshPayload } from './auth.types';

const REFRESH_TOKEN_BYTES = 48;
const ACCESS_TOKEN_EXPIRY_SECONDS_FALLBACK = 15 * 60;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class TenantAuthService {
  private readonly logger = new Logger(TenantAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly email: EmailService,
  ) {}

  /**
   * Tenant owner login with username + password.
   *
   * Tenant accounts are CREATED BY SUPER-ADMIN (no self-signup, per spec).
   * The tenant cannot log in if their tenant record is suspended/hidden or
   * deleted — even if password is correct.
   */
  async login(
    username: string,
    password: string,
  ): Promise<{
    tenantId: string;
    tenantUserId: string;
    tokens: AuthTokenPair;
  }> {
    // Pre-auth lookup: no actor context yet, so bypass scoping.
    const user = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.findUnique({
        where: { username },
        include: { tenant: true },
      }),
    );

    // Generic error message — never reveal whether username exists.
    const denied = new UnauthorizedException({
      code: 'LOGIN_INVALID',
      message: 'Invalid username or password.',
    });

    if (!user) {
      // Still hash a dummy password to avoid timing leaks.
      await bcrypt.compare(password, '$2b$10$DummyHashToPreventTimingSideChannel.');
      throw denied;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw denied;

    if (user.tenant.deletedAt) {
      throw new UnauthorizedException({
        code: 'TENANT_DELETED',
        message: 'This tenant account has been removed. Contact Tahawash support.',
      });
    }

    if (user.tenant.status === 'hidden') {
      throw new UnauthorizedException({
        code: 'TENANT_HIDDEN',
        message: 'This tenant account is no longer active. Contact Tahawash support.',
      });
    }

    // Note: 'suspended' tenants can still log in (read-only admin) — they can
    // see their dashboard with the suspension banner; they just can't accept
    // payments because their bays are hidden from customers.
    // Only 'hidden' tenants are blocked from logging in entirely.

    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    const tokens = await this.issueTokens(user.id, user.tenantId, user.username);
    this.logger.log(`Tenant user ${user.username} (tenant=${user.tenantId}) logged in`);

    return { tenantId: user.tenantId, tenantUserId: user.id, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: TenantRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<TenantRefreshPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token is invalid or expired.',
      });
    }

    if (payload.type !== 'tenant_refresh') {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID' });
    }

    const tokenHash = hashTokenForDb(refreshToken);
    const stored = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantRefreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { tenant: true } } },
      }),
    );

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'Refresh token has been revoked. Please log in again.',
      });
    }

    if (stored.userId !== payload.sub) {
      throw new UnauthorizedException({ code: 'REFRESH_MISMATCH' });
    }

    if (stored.user.tenant.deletedAt || stored.user.tenant.status === 'hidden') {
      throw new UnauthorizedException({ code: 'TENANT_UNAVAILABLE' });
    }

    // Rotate: revoke old, issue new pair.
    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
    );

    return this.issueTokens(stored.userId, stored.user.tenantId, stored.user.username);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashTokenForDb(refreshToken);
    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  /**
   * Tenant user changes their own password.
   *
   * Verifies the current password first (proves identity, lets us surface
   * a clean error). On success, bcrypt-hashes the new password AND
   * revokes every refresh token this user has — sessions on other devices
   * are killed next time they try to refresh. The CURRENT request's
   * access token stays valid until expiry; the client typically calls
   * its own logout-everywhere flow right after to kick the local
   * session too.
   */
  async changePassword(
    tenantUserId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.findUnique({
        where: { id: tenantUserId },
      }),
    );

    if (!user) {
      // Treat unknown user as a generic password mismatch — same response
      // shape so a stolen access token can't probe for valid user ids.
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: 'Current password is incorrect.',
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: 'Current password is incorrect.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await RequestContext.withBypass(async () => {
      await this.prisma.scoped.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          // Clear any pending reset token — they just set a new password the
          // proper way; the link they may have had is no longer valid intent.
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      await this.prisma.scoped.tenantRefreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.log(`Tenant user ${user.username} changed password (sessions revoked)`);
  }

  /**
   * Revoke every refresh token for this tenant user — "sign out
   * everywhere." The current access token stays valid until expiry
   * (max 15m); clients typically clear their local token store right
   * after so the user is logged out on this device too.
   */
  async logoutEverywhere(tenantUserId: string): Promise<void> {
    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantRefreshToken.updateMany({
        where: { userId: tenantUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
    this.logger.log(`Tenant user ${tenantUserId} logged out everywhere`);
  }

  /**
   * Tenant forgot-password request.
   *
   * Always responds successfully — never reveal whether the identifier
   * matched (prevents user enumeration). When it DOES match, we mint a
   * random token, store its hash + a 1-hour expiry on the TenantUser row,
   * and fire the password-reset email via EmailService (Mock provider in
   * dev logs the link; ResendEmailProvider will render the real template).
   *
   * The user is matched by either username (TenantUser.username) or owner
   * email (Tenant.ownerEmail) so admin can paste either.
   */
  async requestPasswordReset(usernameOrEmail: string): Promise<void> {
    const value = usernameOrEmail.trim();
    if (!value) return;

    const user = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.findFirst({
        where: {
          OR: [{ username: value }, { tenant: { ownerEmail: value } }],
        },
        include: { tenant: true },
      }),
    );

    // Don't leak existence; succeed silently if no match.
    if (!user) {
      this.logger.log(`Forgot-password requested for "${value}" — no match (silent ok)`);
      return;
    }

    // Block hidden / deleted tenants from even initiating reset.
    if (user.tenant.deletedAt || user.tenant.status === 'hidden') {
      this.logger.log(
        `Forgot-password skipped for tenant ${user.tenantId} (status=${user.tenant.status}, deleted=${!!user.tenant.deletedAt})`,
      );
      return;
    }

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashTokenForDb(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordResetToken: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      }),
    );

    const adminUrl = this.config.get('ADMIN_APP_URL', { infer: true });
    const resetLink = `${adminUrl}/reset-password?token=${rawToken}`;

    await this.email.sendTemplated({
      to: user.tenant.ownerEmail,
      template: 'tenant-password-reset',
      locale: 'en', // TODO: store tenant preferred locale, default to AZ
      variables: {
        brandName: user.tenant.brandName,
        ownerName: user.tenant.ownerName,
        resetLink,
        expiresInMinutes: '60',
      },
    });

    this.logger.log(
      `Password reset issued for tenant=${user.tenantId} user=${user.username} (expires=${expiresAt.toISOString()})`,
    );
  }

  /**
   * Tenant reset-password — exchange a valid reset token for a new password.
   *
   * Side effects on success:
   *   - bcrypt-hash + persist newPassword
   *   - clear passwordResetToken + passwordResetExpiresAt
   *   - revoke ALL existing refresh tokens (defense — assume the token
   *     leaked into the user's email which may also be compromised)
   *
   * Errors return 400 with structured codes — UI maps to user-friendly text.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashTokenForDb(token);

    const user = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantUser.findUnique({
        where: { passwordResetToken: tokenHash },
        include: { tenant: true },
      }),
    );

    if (!user || !user.passwordResetExpiresAt) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'This reset link is invalid. Request a new one.',
      });
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_EXPIRED',
        message: 'This reset link has expired. Request a new one.',
      });
    }

    if (user.tenant.deletedAt || user.tenant.status === 'hidden') {
      throw new BadRequestException({
        code: 'TENANT_UNAVAILABLE',
        message: 'This tenant account is not available. Contact Tahawash support.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await RequestContext.withBypass(async () => {
      await this.prisma.scoped.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      // Revoke every outstanding refresh token — force re-login everywhere.
      await this.prisma.scoped.tenantRefreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.log(`Password reset completed for tenant=${user.tenantId} user=${user.username}`);
  }

  // ─── INTERNAL ────────────────────────────────────────────────

  private async issueTokens(
    tenantUserId: string,
    tenantId: string,
    username: string,
  ): Promise<AuthTokenPair> {
    const accessTokenExpiry = this.config.get('JWT_ACCESS_EXPIRY', { infer: true });
    const refreshTokenExpiry = this.config.get('JWT_REFRESH_EXPIRY', { infer: true });

    const accessPayload: TenantJwtPayload = {
      sub: tenantUserId,
      tenantId,
      username,
      type: 'tenant',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTokenExpiry as unknown as number,
    });

    const jti = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshPayload: TenantRefreshPayload = {
      sub: tenantUserId,
      jti,
      type: 'tenant_refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTokenExpiry as unknown as number,
    });

    await RequestContext.withBypass(() =>
      this.prisma.scoped.tenantRefreshToken.create({
        data: {
          userId: tenantUserId,
          tokenHash: hashTokenForDb(refreshToken),
          expiresAt: parseDurationToFutureDate(refreshTokenExpiry),
        },
      }),
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn:
        parseDurationToSeconds(accessTokenExpiry) ?? ACCESS_TOKEN_EXPIRY_SECONDS_FALLBACK,
    };
  }
}
