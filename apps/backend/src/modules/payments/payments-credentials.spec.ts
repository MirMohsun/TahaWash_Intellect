import { RequestContext } from '../../common/request-context';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';

jest.spyOn(RequestContext, 'withBypass').mockImplementation((fn: () => unknown) => fn() as never);

function makeHarness(opts?: { tenant?: Record<string, unknown> | null; cipherConfigured?: boolean }) {
  const updated: Record<string, unknown>[] = [];
  const prisma = {
    scoped: {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'tenant' in opts
            ? opts.tenant
            : { ePointMerchantId: 'i000000001', ePointPrivateKeyEnc: 'enc' },
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          updated.push(data);
          return data;
        }),
      },
    },
  };
  const cipher = {
    isConfigured: () => opts?.cipherConfigured ?? true,
    encrypt: jest.fn((s: string) => `v1.enc(${s})`),
    decrypt: jest.fn(),
  };
  const config = { get: () => 'mock' };
  const service = new PaymentsService(
    prisma as never,
    config as never,
    cipher as never,
    new MockPaymentProvider(),
  );
  return { service, prisma, cipher, updated };
}

describe('PaymentsService — tenant credential management', () => {
  it('getCredentialStatus reports configured + merchant id, never the secret', async () => {
    const { service } = makeHarness();
    const res = await service.getCredentialStatus('ten_1');
    expect(res).toEqual({ configured: true, merchantId: 'i000000001' });
    expect(JSON.stringify(res)).not.toContain('enc');
  });

  it('getCredentialStatus reports not-configured when only the merchant id is set', async () => {
    const { service } = makeHarness({ tenant: { ePointMerchantId: 'i1', ePointPrivateKeyEnc: null } });
    expect(await service.getCredentialStatus('ten_1')).toEqual({ configured: false, merchantId: 'i1' });
  });

  it('setCredentials encrypts the private key before storing it', async () => {
    const { service, cipher, updated } = makeHarness();
    const res = await service.setCredentials('ten_1', '  i000000002  ', '  my-secret-key  ');

    expect(cipher.encrypt).toHaveBeenCalledWith('my-secret-key'); // trimmed
    expect(updated[0]!.ePointMerchantId).toBe('i000000002'); // trimmed
    expect(updated[0]!.ePointPrivateKeyEnc).toBe('v1.enc(my-secret-key)');
    expect(updated[0]!.ePointPrivateKeyEnc).not.toBe('my-secret-key'); // never plaintext
    expect(res).toEqual({ configured: true, merchantId: 'i000000002' });
  });

  it('setCredentials fails loudly when the server encryption key is missing', async () => {
    const { service } = makeHarness({ cipherConfigured: false });
    await expect(service.setCredentials('ten_1', 'i1', 'secret-key')).rejects.toMatchObject({
      response: { code: 'PAYMENT_ENCRYPTION_KEY_MISSING' },
    });
  });

  it('clearCredentials nulls both fields', async () => {
    const { service, updated } = makeHarness();
    const res = await service.clearCredentials('ten_1');
    expect(updated[0]).toEqual({ ePointMerchantId: null, ePointPrivateKeyEnc: null });
    expect(res).toEqual({ configured: false, merchantId: null });
  });
});
