import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { RequestContext } from '../../common/request-context';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashTokenForDb,
  parseDurationToFutureDate,
  parseDurationToSeconds,
} from './auth-tokens.util';
import type { AuthTokenPair, SuperAdminJwtPayload, SuperAdminRefreshPayload } from './auth.types';

const REFRESH_TOKEN_BYTES = 48;
const ACCESS_TOKEN_EXPIRY_SECONDS_FALLBACK = 15 * 60;

@Injectable()
export class SuperAdminAuthService {
  private readonly logger = new Logger(SuperAdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ userId: string; tokens: AuthTokenPair }> {
    const user = await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminUser.findUnique({ where: { username } }),
    );

    const denied = new UnauthorizedException({
      code: 'LOGIN_INVALID',
      message: 'Invalid username or password.',
    });

    if (!user) {
      // Constant-time dummy compare to prevent username-enumeration via timing.
      await bcrypt.compare(password, '$2b$10$DummyHashToPreventTimingSideChannel.');
      throw denied;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw denied;

    await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    const tokens = await this.issueTokens(user.id, user.username);
    this.logger.log(`Super-admin ${user.username} logged in`);
    return { userId: user.id, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: SuperAdminRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<SuperAdminRefreshPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token is invalid or expired.',
      });
    }

    if (payload.type !== 'super_admin_refresh') {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID' });
    }

    const tokenHash = hashTokenForDb(refreshToken);
    const stored = await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminRefreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
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

    await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
    );

    return this.issueTokens(stored.userId, stored.user.username);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashTokenForDb(refreshToken);
    await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  // ─── INTERNAL ────────────────────────────────────────────────

  private async issueTokens(userId: string, username: string): Promise<AuthTokenPair> {
    const accessTokenExpiry = this.config.get('JWT_ACCESS_EXPIRY', { infer: true });
    const refreshTokenExpiry = this.config.get('JWT_REFRESH_EXPIRY', { infer: true });

    const accessPayload: SuperAdminJwtPayload = {
      sub: userId,
      username,
      type: 'super_admin',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTokenExpiry as unknown as number,
    });

    const jti = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshPayload: SuperAdminRefreshPayload = {
      sub: userId,
      jti,
      type: 'super_admin_refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTokenExpiry as unknown as number,
    });

    await RequestContext.withBypass(() =>
      this.prisma.scoped.superAdminRefreshToken.create({
        data: {
          userId,
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
