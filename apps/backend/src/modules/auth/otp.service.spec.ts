import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';

/**
 * Regression-locking tests for OtpService.verifyOtp.
 *
 * The bug this guards against: when several OTPs were outstanding for one
 * phone (user re-entered their number / hit resend / several codes sitting in
 * the dev server log), only the single NEWEST code was accepted — every other
 * genuinely-issued, unexpired code was rejected as OTP_INVALID. Fixed by
 * matching the typed code against ANY live (unconsumed, unexpired) OTP.
 */

interface Row {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attemptsCount: number;
  consumedAt: Date | null;
  createdAt: Date;
}

/** Minimal in-memory stand-in for the subset of prisma.otpCode the service uses. */
function makeFakePrisma() {
  const rows: Row[] = [];
  let id = 0;
  let seq = 0; // monotonic createdAt so "newest" ordering is deterministic

  const matches = (r: Row, where: Record<string, any>): boolean => {
    if (where.phone !== undefined && r.phone !== where.phone) return false;
    if ('consumedAt' in where && where.consumedAt === null && r.consumedAt !== null) return false;
    if (where.codeHash !== undefined && r.codeHash !== where.codeHash) return false;
    if (where.expiresAt?.gt !== undefined && !(r.expiresAt > where.expiresAt.gt)) return false;
    if (where.createdAt?.gte !== undefined && !(r.createdAt >= where.createdAt.gte)) return false;
    return true;
  };

  const otpCode = {
    count: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data }: any) => {
      const row: Row = {
        id: `otp_${++id}`,
        attemptsCount: 0,
        consumedAt: null,
        createdAt: new Date(1_700_000_000_000 + ++seq * 1000),
        ...data,
      };
      rows.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      let res = rows.filter((r) => matches(r, where));
      if (orderBy?.createdAt === 'desc') {
        res = [...res].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return res[0] ?? null;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error(`row ${where.id} not found`);
      if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
      if (data.attemptsCount?.increment !== undefined) {
        row.attemptsCount += data.attemptsCount.increment;
      }
      return row;
    }),
  };

  return { prisma: { otpCode } as any, rows };
}

function makeService() {
  const { prisma, rows } = makeFakePrisma();
  const codes: { phone: string; code: string }[] = [];
  const sms = { sendOtp: jest.fn(async (phone: string, code: string) => void codes.push({ phone, code })) };
  const service = new OtpService(prisma, sms as any);
  return { service, rows, codes };
}

const PHONE = '+994501234567';

describe('OtpService.verifyOtp', () => {
  it('accepts an EARLIER still-valid code when several OTPs are outstanding (the regression)', async () => {
    const { service, codes, rows } = makeService();

    // Three OTPs requested in quick succession — all live.
    await service.requestOtp(PHONE);
    await service.requestOtp(PHONE);
    await service.requestOtp(PHONE);
    expect(codes).toHaveLength(3);

    // Verify with the FIRST (oldest) code — previously rejected as OTP_INVALID.
    await expect(service.verifyOtp(PHONE, codes[0].code)).resolves.toBeUndefined();

    // The matching row is consumed; the others remain untouched.
    const consumed = rows.filter((r) => r.consumedAt !== null);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].codeHash).toBe(rows[0].codeHash);
  });

  it('accepts the newest code too', async () => {
    const { service, codes } = makeService();
    await service.requestOtp(PHONE);
    await service.requestOtp(PHONE);
    await expect(service.verifyOtp(PHONE, codes[1].code)).resolves.toBeUndefined();
  });

  it('rejects a wrong code with OTP_INVALID and increments attempts on the newest row', async () => {
    const { service, rows } = makeService();
    await service.requestOtp(PHONE);
    await service.requestOtp(PHONE);

    await expect(service.verifyOtp(PHONE, '000000')).rejects.toMatchObject({
      response: { code: 'OTP_INVALID' },
    });
    const newest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    expect(newest.attemptsCount).toBe(1);
  });

  it('throws OTP_NOT_FOUND when no OTP was ever issued', async () => {
    const { service } = makeService();
    await expect(service.verifyOtp(PHONE, '123456')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.verifyOtp(PHONE, '123456')).rejects.toMatchObject({
      response: { code: 'OTP_NOT_FOUND' },
    });
  });

  it('throws OTP_EXPIRED when all outstanding OTPs have expired', async () => {
    const { service, codes, rows } = makeService();
    await service.requestOtp(PHONE);
    // Force the only outstanding OTP into the past.
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.verifyOtp(PHONE, codes[0].code)).rejects.toMatchObject({
      response: { code: 'OTP_EXPIRED' },
    });
  });

  it('does not allow a consumed code to be reused', async () => {
    const { service, codes } = makeService();
    await service.requestOtp(PHONE);
    await expect(service.verifyOtp(PHONE, codes[0].code)).resolves.toBeUndefined();
    // Second use of the same (now consumed, and only) code → nothing live left.
    await expect(service.verifyOtp(PHONE, codes[0].code)).rejects.toMatchObject({
      response: { code: 'OTP_NOT_FOUND' },
    });
  });
});
