import { randomBytes } from 'node:crypto';
import { CredentialCipherService } from './credential-cipher.service';

function makeService(key?: string): CredentialCipherService {
  // The service only reads PAYMENT_ENCRYPTION_KEY from config.
  return new CredentialCipherService({ get: () => key } as never);
}

describe('CredentialCipherService', () => {
  it('round-trips a tenant secret when a key is configured', () => {
    const svc = makeService(randomBytes(32).toString('base64'));
    expect(svc.isConfigured()).toBe(true);

    const secret = 'd3hjsl38sd8kdfhbcea0be04eafde9e8e2bad2fb092d';
    const enc = svc.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('reports unconfigured and throws on use when no key is set', () => {
    const svc = makeService(undefined);
    expect(svc.isConfigured()).toBe(false);
    expect(() => svc.encrypt('x')).toThrow(/PAYMENT_ENCRYPTION_KEY/);
    expect(() => svc.decrypt('x')).toThrow(/PAYMENT_ENCRYPTION_KEY/);
  });

  it('fails fast at construction on a malformed key', () => {
    expect(() => makeService('too-short')).toThrow();
  });

  it('cannot decrypt a secret encrypted under a different key', () => {
    const a = makeService(randomBytes(32).toString('base64'));
    const b = makeService(randomBytes(32).toString('base64'));
    const enc = a.encrypt('secret');
    expect(() => b.decrypt(enc)).toThrow();
  });
});
