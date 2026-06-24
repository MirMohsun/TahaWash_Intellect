import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * ePoint.az request signing + callback verification.
 *
 * Scheme (NOT HMAC — a salted SHA-1, verified byte-for-byte against ePoint's
 * official published example at developer.epoint.az/en/authentication; see the
 * golden-vector test in epoint-signature.util.spec.ts):
 *
 *   data      = base64( utf8( JSON string of the payload ) )
 *   signature = base64( sha1( utf8( private_key + data + private_key ) ) )   // raw-binary sha1
 *
 * Every outgoing API call AND every inbound callback uses this same scheme with
 * the merchant's `private_key`. That key is a PER-TENANT secret — it must never
 * be logged, returned in an API response, or stored in plaintext.
 */

export interface SignedPayload {
  /** base64(JSON) — sent as the `data` POST field. */
  data: string;
  /** base64(sha1(...)) — sent as the `signature` POST field. */
  signature: string;
}

/**
 * base64-encode the JSON payload exactly as ePoint expects.
 *
 * Note: key order is whatever the caller put in the object. It does NOT need to
 * match ePoint's example — the signature is computed over OUR exact `data`
 * string and ePoint re-verifies against that same string, so any consistent
 * ordering is valid. (The golden-vector test pins a specific order only to
 * prove the sha1/base64 mechanics.)
 */
export function encodeData(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/** Compute the ePoint signature for an already base64-encoded `data` string. */
export function generateSignature(data: string, privateKey: string): string {
  return createHash('sha1')
    .update(privateKey + data + privateKey, 'utf8')
    .digest('base64');
}

/** Build the `{ data, signature }` pair for an outgoing request. */
export function signPayload(payload: Record<string, unknown>, privateKey: string): SignedPayload {
  const data = encodeData(payload);
  return { data, signature: generateSignature(data, privateKey) };
}

/**
 * Constant-time verification of a callback's signature against our private_key.
 *
 * Returns `false` (never throws) on any mismatch or malformed input — the caller
 * decides how to respond (we reject the webhook with 400). Using
 * `timingSafeEqual` avoids leaking, via response timing, how many leading bytes
 * of a forged signature were correct.
 */
export function verifySignature(data: string, signature: string, privateKey: string): boolean {
  const expected = Buffer.from(generateSignature(data, privateKey), 'utf8');
  const provided = Buffer.from(signature ?? '', 'utf8');
  // timingSafeEqual throws on unequal lengths; the length of a base64 SHA-1 is
  // fixed (28 chars), so a length mismatch is itself a rejection.
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Decode a callback's base64 `data` field back into the object ePoint sent. */
export function decodeData(data: string): Record<string, unknown> {
  const json = Buffer.from(data, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}
