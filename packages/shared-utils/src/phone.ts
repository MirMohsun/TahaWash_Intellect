/**
 * Azerbaijani phone number helpers.
 * Locked: +994 country code only (spec round 4).
 *
 * Internal storage format: E.164 with leading + → "+994501234567" (13 chars)
 *   This matches the backend's RequestOtpDto regex (^\+994\d{9}$) and the
 *   standard E.164 representation. Wire format and DB format are identical.
 * Display format (full):    "+994 50 234 56 78"
 * Display format (masked):  "+994 50 ••• ••67"
 */

const COUNTRY_CODE = '994';
const COUNTRY_DIGITS = COUNTRY_CODE.length;
const LOCAL_DIGITS = 9;
const TOTAL_DIGITS = COUNTRY_DIGITS + LOCAL_DIGITS;

/**
 * Normalize a phone input to E.164 with leading +.
 * Accepts: "+994 50 234 56 78", "994501234567", "50 234 56 78" (assumes AZ),
 *          "0501234567" (strips leading 0).
 * Returns: "+994501234567" or null if invalid.
 */
export function normalizeAzPhone(input: string): string | null {
  const digitsOnly = input.replace(/\D/g, '');
  // Strip leading zeros / 8s that some users type
  let local: string | null = null;
  if (digitsOnly.length === TOTAL_DIGITS && digitsOnly.startsWith(COUNTRY_CODE)) {
    local = digitsOnly.slice(COUNTRY_DIGITS);
  } else if (digitsOnly.length === LOCAL_DIGITS) {
    local = digitsOnly;
  } else if (digitsOnly.length === LOCAL_DIGITS + 1 && digitsOnly.startsWith('0')) {
    local = digitsOnly.slice(1);
  }
  if (!local || local.length !== LOCAL_DIGITS) return null;
  return `+${COUNTRY_CODE}${local}`;
}

/**
 * True if input is a valid AZ phone (in any accepted form).
 */
export function validateAzPhone(input: string): boolean {
  const normalized = normalizeAzPhone(input);
  if (!normalized) return false;
  // AZ mobile prefixes: 50, 51, 55, 70, 77, 99 (Azercell), 70, 60 (others)
  // We don't enforce specific operators here — leave that to backend / ePoint
  return /^\+994[1-9]\d{8}$/.test(normalized);
}

/**
 * Format an E.164 number as "+994 50 234 56 78".
 * Returns the input unchanged if not a valid AZ phone.
 */
export function formatAzPhone(phone: string, opts?: { mask?: boolean }): string {
  const normalized = normalizeAzPhone(phone);
  if (!normalized) return phone;

  // normalized is "+994XXXXXXXXX"; skip the "+994" prefix (4 chars) to get
  // the 9-digit local part, then carve into operator / a / b / c blocks.
  const op = normalized.slice(4, 6);
  const a = normalized.slice(6, 9);
  const b = normalized.slice(9, 11);
  const c = normalized.slice(11, 13);

  if (opts?.mask) {
    return `+994 ${op} ••• ••${c}`;
  }
  return `+994 ${op} ${a} ${b} ${c}`;
}
