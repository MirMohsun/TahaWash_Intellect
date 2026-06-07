import {
  hashTokenForDb,
  parseDurationToFutureDate,
  parseDurationToSeconds,
} from './auth-tokens.util';

describe('auth-tokens util', () => {
  describe('hashTokenForDb', () => {
    it('produces a 64-char hex string (SHA-256)', () => {
      const hash = hashTokenForDb('refresh-token-xyz');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic — same input → same hash', () => {
      const a = hashTokenForDb('same-input');
      const b = hashTokenForDb('same-input');
      expect(a).toBe(b);
    });

    it('different inputs → different hashes (no collisions on trivial inputs)', () => {
      expect(hashTokenForDb('token-a')).not.toBe(hashTokenForDb('token-b'));
      // Single-char delta — SHA-256 should spread it widely.
      expect(hashTokenForDb('abc')).not.toBe(hashTokenForDb('abd'));
    });

    it('handles empty + unicode without throwing', () => {
      expect(hashTokenForDb('')).toMatch(/^[0-9a-f]{64}$/);
      expect(hashTokenForDb('🔑✨ Tahawash')).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('parseDurationToSeconds', () => {
    it('parses seconds', () => {
      expect(parseDurationToSeconds('30s')).toBe(30);
      expect(parseDurationToSeconds('1s')).toBe(1);
    });

    it('parses minutes', () => {
      expect(parseDurationToSeconds('15m')).toBe(15 * 60);
    });

    it('parses hours', () => {
      expect(parseDurationToSeconds('2h')).toBe(2 * 3600);
    });

    it('parses days', () => {
      expect(parseDurationToSeconds('30d')).toBe(30 * 86_400);
    });

    it('returns null for malformed input', () => {
      expect(parseDurationToSeconds('')).toBeNull();
      expect(parseDurationToSeconds('15')).toBeNull(); // no unit
      expect(parseDurationToSeconds('m')).toBeNull(); // no number
      expect(parseDurationToSeconds('15min')).toBeNull(); // wrong unit
      expect(parseDurationToSeconds('-15m')).toBeNull(); // signed
      expect(parseDurationToSeconds('1.5h')).toBeNull(); // decimal
      expect(parseDurationToSeconds('15M')).toBeNull(); // case-sensitive
    });
  });

  describe('parseDurationToFutureDate', () => {
    it('returns a Date in the future for a valid duration', () => {
      const before = Date.now();
      const future = parseDurationToFutureDate('30d');
      const after = Date.now();
      // Should be ~30 days from now (allow a few ms of test runtime slop).
      const diff = future.getTime() - before;
      expect(diff).toBeGreaterThanOrEqual(30 * 86_400 * 1000);
      expect(diff).toBeLessThanOrEqual(30 * 86_400 * 1000 + (after - before) + 10);
    });

    it('falls back to default (30d) on unparseable input', () => {
      const before = Date.now();
      const future = parseDurationToFutureDate('nonsense');
      const diff = future.getTime() - before;
      // Default fallback is 30 days.
      expect(diff).toBeGreaterThanOrEqual(30 * 86_400 * 1000 - 100);
      expect(diff).toBeLessThanOrEqual(30 * 86_400 * 1000 + 100);
    });

    it('honors a custom fallbackSeconds argument', () => {
      const before = Date.now();
      const future = parseDurationToFutureDate('nonsense', 60);
      const diff = future.getTime() - before;
      // Custom fallback = 60 seconds.
      expect(diff).toBeGreaterThanOrEqual(60 * 1000 - 100);
      expect(diff).toBeLessThanOrEqual(60 * 1000 + 100);
    });
  });
});
