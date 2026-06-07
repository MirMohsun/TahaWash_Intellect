import { bakuCalendarDay, classifySubscriptionWindow } from './subscription-window.logic';

describe('subscription window logic', () => {
  describe('bakuCalendarDay', () => {
    it('returns the Baku calendar day for a UTC instant', () => {
      // 2026-05-27T20:00:00Z = 2026-05-28T00:00:00 Baku (UTC+4)
      expect(bakuCalendarDay(new Date('2026-05-27T20:00:00Z'))).toBe('2026-05-28');
    });

    it('matches the Baku day at exactly midnight UTC', () => {
      // 2026-05-27T00:00:00Z = 2026-05-27T04:00:00 Baku
      expect(bakuCalendarDay(new Date('2026-05-27T00:00:00Z'))).toBe('2026-05-27');
    });

    it('rolls over at 20:00 UTC (00:00 Baku next day)', () => {
      expect(bakuCalendarDay(new Date('2026-05-27T19:59:00Z'))).toBe('2026-05-27');
      expect(bakuCalendarDay(new Date('2026-05-27T20:00:00Z'))).toBe('2026-05-28');
    });
  });

  describe('classifySubscriptionWindow', () => {
    // "now" anchored to 2026-05-27 Baku noon-ish.
    const now = new Date('2026-05-27T08:00:00Z'); // 12:00 Baku

    it('returns null when subscriptionEnd is null', () => {
      expect(classifySubscriptionWindow(null, now)).toBeNull();
    });

    it('classifies T-7 exactly 7 days before end', () => {
      // Subscription ends 2026-06-03 Baku → 7 days from 2026-05-27.
      expect(classifySubscriptionWindow(new Date('2026-06-03T08:00:00Z'), now)).toBe('t_minus_7');
    });

    it('classifies T-1 the day before end', () => {
      expect(classifySubscriptionWindow(new Date('2026-05-28T08:00:00Z'), now)).toBe('t_minus_1');
    });

    it('classifies T-0 the same calendar day as end', () => {
      // Use 15:00 UTC = 19:00 Baku — still 2026-05-27 in Baku (same day as `now`).
      expect(classifySubscriptionWindow(new Date('2026-05-27T15:00:00Z'), now)).toBe('t_zero');
    });

    it('classifies T+7 exactly 7 days after end (auto-suspend trigger)', () => {
      // Subscription ended 2026-05-20 Baku → grace period over today.
      expect(classifySubscriptionWindow(new Date('2026-05-20T08:00:00Z'), now)).toBe('t_plus_7');
    });

    it('returns null for in-between days (no notice fires)', () => {
      // T-2 — no spec'd notice on this day
      expect(classifySubscriptionWindow(new Date('2026-05-29T08:00:00Z'), now)).toBeNull();
      // T+3 — between expiry and auto-suspend (silent grace period)
      expect(classifySubscriptionWindow(new Date('2026-05-24T08:00:00Z'), now)).toBeNull();
    });

    it('returns null for far-future / far-past', () => {
      expect(classifySubscriptionWindow(new Date('2027-01-01T00:00:00Z'), now)).toBeNull();
      expect(classifySubscriptionWindow(new Date('2025-01-01T00:00:00Z'), now)).toBeNull();
    });

    it('handles the Baku/UTC boundary correctly (subscriptionEnd just before midnight UTC)', () => {
      // 23:59 UTC on 2026-05-27 = 03:59 Baku on 2026-05-28 — that's TOMORROW Baku.
      // From perspective of `now` = 2026-05-27 noon Baku, that's T-1.
      expect(classifySubscriptionWindow(new Date('2026-05-27T23:59:00Z'), now)).toBe('t_minus_1');
    });
  });
});
