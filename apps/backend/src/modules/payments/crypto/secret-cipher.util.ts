import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption (AES-256-GCM) for secrets at rest — specifically
 * each tenant's ePoint `private_key`, which we must store but must never keep
 * in plaintext.
 *
 * Master key: PAYMENT_ENCRYPTION_KEY (32 bytes, base64 or hex).
 *
 * Stored string format:  v1.<base64 iv>.<base64 authTag>.<base64 ciphertext>
 *   - fresh random 12-byte IV per encryption (GCM standard nonce size),
 *   - 16-byte GCM auth tag → decryption THROWS if the ciphertext, IV, or tag
 *     was modified (tamper-evident),
 *   - a versioned prefix so the scheme can be rotated later without ambiguity.
 *
 * The same plaintext encrypts to a different string each time (random IV), which
 * is correct for confidentiality and avoids leaking equality of secrets.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALGO = 'aes-256-gcm';

/**
 * Parse the 32-byte master key from a base64 or hex env string. Throws a clear
 * error if it doesn't decode to exactly 32 bytes — we never silently truncate
 * or pad a key.
 */
export function loadEncryptionKey(raw: string): Buffer {
  for (const encoding of ['base64', 'hex'] as const) {
    try {
      const buf = Buffer.from(raw, encoding);
      // base64/hex decoders are lenient; only accept an exact 32-byte result.
      if (buf.length === KEY_BYTES) return buf;
    } catch {
      // try the next encoding
    }
  }
  throw new Error(
    `PAYMENT_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64 or hex). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
  );
}

/** Encrypt a UTF-8 secret. Returns the `v1.iv.tag.ct` string to persist. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/**
 * Decrypt a `v1.iv.tag.ct` string. Throws if the format/version is wrong or if
 * the GCM tag fails (tampered ciphertext or wrong key).
 */
export function decryptSecret(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted secret (expected "v1.<iv>.<tag>.<ciphertext>").');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws "Unsupported state or unable to authenticate data" if the
  // tag doesn't match — i.e. the secret was tampered with or the key is wrong.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
