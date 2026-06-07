import { createHash } from 'node:crypto';

/** SHA-256 hash of a token for at-rest storage. Never store raw tokens. */
export function hashTokenForDb(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Crude duration parser ("15m", "30d", "1h", "60s").
 * Returns seconds, or null if unparseable.
 */
export function parseDurationToSeconds(input: string): number | null {
  const match = /^(\d+)([smhd])$/.exec(input);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const mult = multipliers[unit!];
  if (!mult) return null;
  return value * mult;
}

export function parseDurationToFutureDate(input: string, fallbackSeconds = 30 * 86400): Date {
  const seconds = parseDurationToSeconds(input) ?? fallbackSeconds;
  return new Date(Date.now() + seconds * 1000);
}
