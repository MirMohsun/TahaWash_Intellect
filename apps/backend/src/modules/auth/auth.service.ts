import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashTokenForDb,
  parseDurationToFutureDate,
  parseDurationToSeconds,
} from './auth-tokens.util';
import type { AuthTokenPair, CustomerJwtPayload, CustomerRefreshPayload } from './auth.types';

// Wire shape mirrored from packages/shared-types Customer — kept local so
// the backend doesn't take a workspace dep just for one DTO. If you change
// fields here, also update packages/shared-types/src/customer.ts.
export interface CustomerWire {
  id: string;
  phone: string;
  name: string | null;
  language: 'az' | 'ru' | 'en';
  city: string | null;
  pushToken: string | null;
  pushPlatform: 'ios' | 'android' | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
import { OtpService } from './otp.service';

const REFRESH_TOKEN_BYTES = 48; // 384-bit random tokens — plenty.
const ACCESS_TOKEN_EXPIRY_SECONDS_FALLBACK = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /** Step 1 of customer login: send a 6-digit code to their phone. */
  async requestCustomerOtp(phone: string): Promise<{ phone: string }> {
    await this.otp.requestOtp(phone);
    return { phone };
  }

  /**
   * Step 2 of customer login: verify the code, create-or-find customer,
   * and issue a fresh JWT access + refresh pair.
   *
   * Response shape is flat (accessToken / refreshToken / customer) — this is
   * what the mobile auth-api consumer expects and what writes to the auth
   * Zustand store + SecureStore. The previous nested `{ customerId, tokens }`
   * shape caused `res.accessToken` to be undefined on the client, which made
   * SecureStore.setItemAsync throw, which surfaced as a fake "Network error"
   * after the OTP had actually succeeded.
   */
  async verifyCustomerOtp(
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; customer: CustomerWire }> {
    await this.otp.verifyOtp(phone, code);

    // Create-or-update customer record. If they previously deleted their
    // account (deletedAt set), revive it by clearing deletedAt.
    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: { deletedAt: null },
      create: { phone },
    });

    const tokens = await this.issueTokens(customer.id, customer.phone);
    this.logger.log(`Customer ${customer.id} authenticated via OTP`);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        language: customer.language,
        city: customer.city,
        pushToken: customer.pushToken,
        pushPlatform: customer.pushPlatform as 'ios' | 'android' | null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        deletedAt: customer.deletedAt?.toISOString() ?? null,
      },
    };
  }

  /**
   * Exchange a valid refresh token for a NEW token pair.
   * Rotation: the old refresh token is revoked and replaced.
   */
  async refreshCustomerSession(refreshToken: string): Promise<AuthTokenPair> {
    let payload: CustomerRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<CustomerRefreshPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token is invalid or expired.',
      });
    }

    if (payload.type !== 'customer_refresh') {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token is invalid.',
      });
    }

    const tokenHash = hashTokenForDb(refreshToken);
    const stored = await this.prisma.customerRefreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'Refresh token has been revoked. Please log in again.',
      });
    }

    if (stored.customerId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'REFRESH_MISMATCH',
        message: 'Refresh token does not match its owner.',
      });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: stored.customerId },
    });
    if (!customer || customer.deletedAt) {
      throw new UnauthorizedException({
        code: 'CUSTOMER_DELETED',
        message: 'Account no longer exists.',
      });
    }

    // Rotate: revoke the old refresh token, issue a fresh pair.
    await this.prisma.customerRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(customer.id, customer.phone);
  }

  /** Revoke a refresh token (logout). Safe to call with a stale/invalid token. */
  async logoutCustomer(refreshToken: string): Promise<void> {
    const tokenHash = hashTokenForDb(refreshToken);
    await this.prisma.customerRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // INTERNAL
  // ─────────────────────────────────────────────────────────────

  private async issueTokens(customerId: string, phone: string): Promise<AuthTokenPair> {
    const accessTokenExpiry = this.config.get('JWT_ACCESS_EXPIRY', { infer: true });
    const refreshTokenExpiry = this.config.get('JWT_REFRESH_EXPIRY', { infer: true });

    const accessPayload: CustomerJwtPayload = {
      sub: customerId,
      phone,
      type: 'customer',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      // expiresIn type from ms is StringValue (template literal); runtime
      // validation in env.schema already constrains the format ("15m" etc.)
      expiresIn: accessTokenExpiry as unknown as number,
    });

    // Refresh token: opaque random string wrapped in a JWT for signed envelope.
    const jti = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshPayload: CustomerRefreshPayload = {
      sub: customerId,
      jti,
      type: 'customer_refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTokenExpiry as unknown as number,
    });

    const expiresAt = parseDurationToFutureDate(refreshTokenExpiry);
    await this.prisma.customerRefreshToken.create({
      data: {
        customerId,
        tokenHash: hashTokenForDb(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn:
        parseDurationToSeconds(accessTokenExpiry) ?? ACCESS_TOKEN_EXPIRY_SECONDS_FALLBACK,
    };
  }
}
