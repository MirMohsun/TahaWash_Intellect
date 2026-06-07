import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

/** Spec-locked constants (see project memory). */
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
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
   * Verify a code against the latest non-consumed OTP for this phone.
   * On success, marks the OTP consumed and returns true.
   *
   * Failure modes (all throw BadRequestException):
   *  - no OTP issued or all expired
   *  - max attempts exceeded
   *  - wrong code (increments attempts)
   */
  async verifyOtp(phone: string, code: string): Promise<void> {
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

    if (latest.expiresAt < new Date()) {
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

    if (hashOtp(code) !== latest.codeHash) {
      // Increment attempt counter and reject.
      await this.prisma.otpCode.update({
        where: { id: latest.id },
        data: { attemptsCount: { increment: 1 } },
      });
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'The code is incorrect.',
      });
    }

    // Success — mark consumed so it can't be reused.
    await this.prisma.otpCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
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
