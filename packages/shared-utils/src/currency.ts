/**
 * Currency formatting for Azerbaijani Manat (AZN).
 * Locked format: "1,50 ₼" — comma decimal separator, manat symbol after the number.
 * Source: project memory `project_yubox_MASTER_SPEC.md`.
 */

const MANAT = '₼';

/**
 * Format a number as AZN currency.
 *
 * @example
 *   formatAZN(2.5)   // "2,50 ₼"
 *   formatAZN(0.5)   // "0,50 ₼"
 *   formatAZN(12)    // "12,00 ₼"
 *   formatAZN(1.555) // "1,56 ₼" (rounded)
 */
export function formatAZN(amount: number): string {
  if (!Number.isFinite(amount)) return `0,00 ${MANAT}`;
  return `${amount.toFixed(2).replace('.', ',')} ${MANAT}`;
}

/**
 * Parse a user-typed AZN string back to a number.
 * Accepts both "," and "." decimal separators.
 * Returns NaN on invalid input — callers should check.
 *
 * @example
 *   parseAZN("2,50 ₼")  // 2.5
 *   parseAZN("12.00")   // 12
 *   parseAZN("abc")     // NaN
 */
export function parseAZN(value: string): number {
  const normalized = value.replace(/[₼\s]/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}
