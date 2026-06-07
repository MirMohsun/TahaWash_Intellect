/**
 * Charge-amount math. Pure, no React.
 *
 * Spec-locked (round 3 & round 4):
 *   - min and step are per-tenant (Tenant.minChargeAmount, chargeStep)
 *   - max is 20.00 AZN globally (spec round 1)
 *   - all increments are in `step` units
 *   - default starting amount = min × 2 if that's ≤ 5.00, else min × 4
 *     (so customers don't see "0.50" as the default — looks broken)
 *
 * Decimal columns from the backend arrive as STRINGS (project pattern,
 * see project_yubox_BACKEND_PATTERNS section 3). All math here uses
 * fixed-point arithmetic on integer "tetri" (1/100 AZN) to avoid the
 * 0.1 + 0.2 = 0.30000000000000004 trap.
 */

const MAX_AMOUNT_TETRI = 2000; // 20.00 AZN

export interface ChargeBounds {
  /** Whole-tetri integer (e.g. 100 for "1.00"). */
  minTetri: number;
  /** Whole-tetri integer (e.g. 50 for "0.50"). */
  stepTetri: number;
  /** Whole-tetri integer (e.g. 2000 for "20.00"). */
  maxTetri: number;
}

/** Parse "1.00" / "0.50" → tetri integer. Throws on malformed input. */
export function parseAznToTetri(decimalString: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(decimalString);
  if (!m) throw new Error(`Invalid AZN decimal "${decimalString}"`);
  const major = Number(m[1]);
  const minorRaw = m[2] ?? '00';
  const minor = Number(minorRaw.padEnd(2, '0'));
  return major * 100 + minor;
}

/** Format tetri integer as "1,00 ₼" — comma decimal per spec. */
export function formatTetri(tetri: number): string {
  const major = Math.floor(tetri / 100);
  const minor = (tetri % 100).toString().padStart(2, '0');
  return `${major},${minor} ₼`;
}

/** Build bounds from the tenant's Decimal-string config. */
export function buildBounds(minDecimal: string, stepDecimal: string): ChargeBounds {
  return {
    minTetri: parseAznToTetri(minDecimal),
    stepTetri: parseAznToTetri(stepDecimal),
    maxTetri: MAX_AMOUNT_TETRI,
  };
}

/**
 * Default starting amount when the charge screen first opens.
 * Heuristic: aim for a "starting offer" that feels intentional, never the bare minimum.
 */
export function defaultAmountTetri(bounds: ChargeBounds): number {
  const candidate = bounds.minTetri * 2;
  if (candidate <= 500) return Math.min(bounds.minTetri * 4, bounds.maxTetri);
  return Math.min(candidate, bounds.maxTetri);
}

export function clampAndStep(value: number, bounds: ChargeBounds): number {
  const clamped = Math.max(bounds.minTetri, Math.min(bounds.maxTetri, value));
  // Snap to nearest valid step above min.
  const offset = clamped - bounds.minTetri;
  const stepped = Math.round(offset / bounds.stepTetri) * bounds.stepTetri;
  return bounds.minTetri + stepped;
}

export function increment(current: number, bounds: ChargeBounds): number {
  return Math.min(current + bounds.stepTetri, bounds.maxTetri);
}

export function decrement(current: number, bounds: ChargeBounds): number {
  return Math.max(current - bounds.stepTetri, bounds.minTetri);
}

export function canIncrement(current: number, bounds: ChargeBounds): boolean {
  return current + bounds.stepTetri <= bounds.maxTetri;
}

export function canDecrement(current: number, bounds: ChargeBounds): boolean {
  return current - bounds.stepTetri >= bounds.minTetri;
}

/** Suggest 4 quick chips between min and 5.00 (or max if that's smaller). */
export function suggestedChips(bounds: ChargeBounds): number[] {
  const cap = Math.min(bounds.maxTetri, 500);
  const out = new Set<number>();
  const candidates = [100, 200, 300, 500];
  for (const c of candidates) {
    if (c >= bounds.minTetri && c <= cap) out.add(c);
  }
  // Pad to 4 from below if we somehow got fewer (rare for normal tenant config).
  let next = bounds.minTetri;
  while (out.size < 4 && next <= cap) {
    out.add(next);
    next += bounds.stepTetri;
  }
  return Array.from(out)
    .sort((a, b) => a - b)
    .slice(0, 4);
}
