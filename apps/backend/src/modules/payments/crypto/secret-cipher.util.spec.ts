import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret, loadEncryptionKey } from './secret-cipher.util';

describe('secret cipher (AES-256-GCM)', () => {
  const key = randomBytes(32);
  const SECRET = 'd3hjsl38sd8kdfhbcea0be04eafde9e8e2bad2fb092d'; // looks like an ePoint private_key

  describe('round-trip', () => {
    it('decrypts back to the original plaintext', () => {
      const enc = encryptSecret(SECRET, key);
      expect(decryptSecret(enc, key)).toBe(SECRET);
    });

    it('handles empty + unicode secrets', () => {
      for (const s of ['', '🔐 gizli açar', 'a'.repeat(2000)]) {
        expect(decryptSecret(encryptSecret(s, key), key)).toBe(s);
      }
    });

    it('produces the documented v1.iv.tag.ct shape', () => {
      const enc = encryptSecret(SECRET, key);
      const parts = enc.split('.');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
    });
  });

  describe('confidentiality', () => {
    it('encrypts the same plaintext to different ciphertexts (random IV)', () => {
      expect(encryptSecret(SECRET, key)).not.toBe(encryptSecret(SECRET, key));
    });

    it('never contains the plaintext', () => {
      expect(encryptSecret(SECRET, key)).not.toContain(SECRET);
    });
  });

  describe('tamper / wrong-key detection', () => {
    it('throws if the ciphertext is modified', () => {
      const enc = encryptSecret(SECRET, key);
      const parts = enc.split('.');
      const ct = Buffer.from(parts[3]!, 'base64');
      ct[0] = ct[0]! ^ 0xff; // flip a byte
      parts[3] = ct.toString('base64');
      expect(() => decryptSecret(parts.join('.'), key)).toThrow();
    });

    it('throws if the auth tag is modified', () => {
      const enc = encryptSecret(SECRET, key);
      const parts = enc.split('.');
      const tag = Buffer.from(parts[2]!, 'base64');
      tag[0] = tag[0]! ^ 0xff;
      parts[2] = tag.toString('base64');
      expect(() => decryptSecret(parts.join('.'), key)).toThrow();
    });

    it('throws when decrypted with the wrong key', () => {
      const enc = encryptSecret(SECRET, key);
      expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
    });

    it('throws on a malformed payload / wrong version', () => {
      expect(() => decryptSecret('not-a-valid-secret', key)).toThrow();
      expect(() => decryptSecret('v2.a.b.c', key)).toThrow();
    });
  });

  describe('loadEncryptionKey', () => {
    it('accepts a 32-byte base64 key', () => {
      const b64 = randomBytes(32).toString('base64');
      expect(loadEncryptionKey(b64)).toHaveLength(32);
    });

    it('accepts a 32-byte hex key', () => {
      const hex = randomBytes(32).toString('hex');
      expect(loadEncryptionKey(hex)).toHaveLength(32);
    });

    it('rejects a key of the wrong length', () => {
      expect(() => loadEncryptionKey(randomBytes(16).toString('base64'))).toThrow();
      expect(() => loadEncryptionKey('too-short')).toThrow();
    });

    it('a key it loads can encrypt + decrypt', () => {
      const loaded = loadEncryptionKey(randomBytes(32).toString('base64'));
      expect(decryptSecret(encryptSecret(SECRET, loaded), loaded)).toBe(SECRET);
    });
  });
});
