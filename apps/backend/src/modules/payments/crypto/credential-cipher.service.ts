import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import { decryptSecret, encryptSecret, loadEncryptionKey } from './secret-cipher.util';

/**
 * Encrypts/decrypts tenant ePoint `private_key`s at rest using the
 * PAYMENT_ENCRYPTION_KEY master key (AES-256-GCM under the hood).
 *
 * The key is parsed + validated ONCE at construction (boot) — a malformed key
 * fails fast there, not at the first payment. If no key is set the service is
 * "unconfigured" and any encrypt/decrypt throws a clear 503; that path is only
 * reachable when PAYMENT_PROVIDER=epoint actually needs a tenant's key.
 */
@Injectable()
export class CredentialCipherService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('PAYMENT_ENCRYPTION_KEY', { infer: true });
    this.key = raw ? loadEncryptionKey(raw) : null;
  }

  /** True when a valid 32-byte master key is configured. */
  isConfigured(): boolean {
    return this.key !== null;
  }

  /** Encrypt a tenant secret for storage. Returns a "v1.iv.tag.ct" string. */
  encrypt(plaintext: string): string {
    return encryptSecret(plaintext, this.requireKey());
  }

  /** Decrypt a stored tenant secret. Throws if it was tampered with or the key changed. */
  decrypt(payload: string): string {
    return decryptSecret(payload, this.requireKey());
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_ENCRYPTION_KEY_MISSING',
        message:
          'PAYMENT_ENCRYPTION_KEY is not set — cannot encrypt/decrypt ePoint credentials. ' +
          'Set it to a 32-byte base64 (or hex) key; required when PAYMENT_PROVIDER=epoint.',
      });
    }
    return this.key;
  }
}
