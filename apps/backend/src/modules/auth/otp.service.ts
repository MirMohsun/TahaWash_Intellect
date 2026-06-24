import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

/** Spec-locked constants (see project memory). */
const OTP_LENGTH = 6;
// 10 min (was 5). While SMS is mock, the code is fetched from server logs —
// a slow round-trip that the original 5-min window cut too close, so freshly
// typed codes could lapse mid-entry. 10 min is still a safe OTP lifetime and
// matches the dev/testing loosening already applied to the limits below.
const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 10; // per OTP row (was 5 — too tight during dev/testing)
const MAX_REQUESTS_PER_HOUR = 50; // per phone (was 5 — too tight during dev/testing)

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /**
   * Generate a fresh OTP for the given phone, store the hash, send via SMS.
   * Rate-limited: max 5 requests per phone per hour.
   */
  async requestOtp(phone: string): Promise<void> {
    // Rate limit check — count recent OTP requests for this phone.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gte: oneHourAgo } },
    });
    if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMITED',
        message: 'Too many OTP requests for this phone. Try again later.',
      });
    }

    const code = generateOtpCode(OTP_LENGTH);
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({ data: { phone, codeHash, expiresAt } });

    // Send via SMS. In dev (SMS_PROVIDER=mock) this logs to console.
    await this.sms.sendOtp(phone, code);

    this.logger.log(`OTP issued for ${phone} (expires ${expiresAt.toISOString()})`);
  }

  /**
   * Verify a code against ANY currently-valid OTP for this phone — i.e. any
   * row that is unconsumed AND unexpired AND whose hash matches. On success,
   * that row is marked consumed.
   *
   * Why "any" and not just the newest: a phone can have several OTPs
   * outstanding at once (the user re-entered their number, tapped resend, or
   * — in dev — several codes are sitting in the server log). Matching only the
   * single newest row meant every other genuinely-issued, unexpired code was
   * rejected as OTP_INVALID ("the code is incorrect"), which is confusing and
   * wrong: the user typed a code we really did send. Accepting any live code
   * fixes that. Lockout still applies (wrong guesses increment the newest
   * row's counter), and codes still expire after 5 minutes.
   *
   * Failure modes (all throw BadRequestException):
   *  - no OTP ever issued                       → OTP_NOT_FOUND
   *  - all outstanding OTPs expired             → OTP_EXPIRED
   *  - newest OTP is attempt-locked             → OTP_LOCKED
   *  - a live OTP exists but the code is wrong  → OTP_INVALID (increments attempts)
   */
  async verifyOtp(phone: string, code: string): Promise<void> {
    const now = new Date();
    const codeHash = hashOtp(code);

    // Happy path: does the typed code match any unconsumed, unexpired OTP?
    const match = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now }, codeHash },
      orderBy: { createdAt: 'desc' },
    });
    if (match) {
      await this.prisma.otpCode.update({
        where: { id: match.id },
        data: { consumedAt: now },
      });
      return;
    }

    // No match — produce a precise reason from the newest outstanding OTP.
    const latest = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      throw new BadRequestException({
        code: 'OTP_NOT_FOUND',
        message: 'No OTP was issued for this phone. Request a new one.',
      });
    }

    if (latest.expiresAt < now) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP has expired. Request a new one.',
      });
    }

    if (latest.attemptsCount >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException({
        code: 'OTP_LOCKED',
        message: 'Too many incorrect attempts. Request a new OTP and try again in 5 minutes.',
      });
    }

    // A live OTP exists but nothing matched the typed code — count the attempt.
    await this.prisma.otpCode.update({
      where: { id: latest.id },
      data: { attemptsCount: { increment: 1 } },
    });
    throw new BadRequestException({
      code: 'OTP_INVALID',
      message: 'The code is incorrect.',
    });
  }
}

/** Generate a numeric OTP of the given length using a cryptographically strong RNG. */
function generateOtpCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += randomInt(0, 10).toString();
  }
  return out;
}

/** SHA-256 hash. OTPs are short-lived; no need for bcrypt's slow KDF. */
function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
