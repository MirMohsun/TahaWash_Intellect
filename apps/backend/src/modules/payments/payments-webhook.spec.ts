import { RequestContext } from '../../common/request-context';
import { signPayload } from './epoint/epoint-signature.util';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';

// withBypass just runs the callback in these unit tests.
jest.spyOn(RequestContext, 'withBypass').mockImplementation((fn: () => unknown) => fn() as never);

const KEY = 'TENANT_PRIVATE_KEY_123';

function makeHarness(txnOverrides?: Record<string, unknown>) {
  const txn: Record<string, unknown> = {
    id: 'txn_1',
    status: 'pending',
    tenantId: 'ten_1',
    customerId: 'cust_1',
    bayId: 'bay_1',
    // Whole AZN — hardware credits whole AZN only.
    amountAzn: { toString: () => '2.00' },
    ...txnOverrides,
  };
  const transaction = {
    findUnique: jest.fn().mockResolvedValue(txn),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(txn, data)),
  };
  const bay = {
    findUnique: jest.fn().mockResolvedValue({ hardwareIdentifier: 'tahawash-wash-01' }),
  };
  const prisma = {
    scoped: {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ten_1', ePointPrivateKeyEnc: 'enc' }),
      },
      transaction,
      savedCard: { upsert: jest.fn() },
    },
    // enqueueBayCredit reads via raw prisma (no HTTP session on a webhook).
    transaction,
    bay,
  };
  // epoint mode → the service decrypts the tenant key via the cipher stub.
  const config = {
    get: (k: string) => (k === 'PAYMENT_PROVIDER' ? 'epoint' : 'https://app.tahawash.az'),
  };
  const cipher = { decrypt: jest.fn(() => KEY), encrypt: jest.fn(), isConfigured: () => true };
  const hardware = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(
    prisma as never,
    config as never,
    cipher as never,
    hardware as never,
    new MockPaymentProvider(),
  );
  return { service, prisma, txn, hardware };
}

/** A genuine ePoint-style callback, signed with the tenant's key. */
const callback = (payload: Record<string, unknown>) => signPayload(payload, KEY);

describe('PaymentsService.handleEpointCallback', () => {
  it('verifies the signature, finalizes the payment, saves the card, and credits the bay', async () => {
    const { service, prisma, txn, hardware } = makeHarness();
    const { data, signature } = callback({
      status: 'success',
      order_id: 'txn_1',
      transaction: 'te_99',
      amount: '2.00',
      card_id: 'card_tok_1',
      card_mask: '411111******1111',
    });

    await service.handleEpointCallback('ten_1', data, signature);

    expect(txn.status).toBe('paid_crediting');
    expect(txn.ePointReference).toBe('te_99');
    // Hardware credit command published for the whole-AZN amount.
    expect(hardware.publish).toHaveBeenCalledWith(
      'tahawash-wash-01',
      expect.objectContaining({ type: 'credit', txId: 'txn_1', amount: 2 }),
    );
    expect(prisma.scoped.savedCard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ePointToken: 'card_tok_1' },
        create: expect.objectContaining({
          customerId: 'cust_1',
          tenantId: 'ten_1',
          ePointToken: 'card_tok_1',
          lastFour: '1111',
          brand: 'visa',
        }),
      }),
    );
  });

  it('marks the transaction declined on a failed callback', async () => {
    const { service, txn, hardware } = makeHarness();
    const { data, signature } = callback({
      status: 'error',
      order_id: 'txn_1',
      message: 'Insufficient funds',
    });

    await service.handleEpointCallback('ten_1', data, signature);

    expect(txn.status).toBe('declined');
    expect(txn.errorReason).toBe('Insufficient funds');
    expect(hardware.publish).not.toHaveBeenCalled();
  });

  it('rejects a forged signature with INVALID_SIGNATURE (→ 400)', async () => {
    const { service, prisma } = makeHarness();
    const { data } = callback({ status: 'success', order_id: 'txn_1' });

    await expect(
      service.handleEpointCallback('ten_1', data, 'forged-signature-AAAA='),
    ).rejects.toMatchObject({ response: { code: 'INVALID_SIGNATURE' } });
    expect(prisma.scoped.transaction.update).not.toHaveBeenCalled();
  });

  it('is idempotent — a repeat callback on an already-finalized txn is a no-op', async () => {
    const { service, prisma, hardware } = makeHarness({ status: 'paid_crediting' });
    const { data, signature } = callback({ status: 'success', order_id: 'txn_1' });

    await service.handleEpointCallback('ten_1', data, signature);

    expect(prisma.scoped.transaction.update).not.toHaveBeenCalled();
    expect(hardware.publish).not.toHaveBeenCalled();
  });

  it("ignores a callback whose order belongs to a different tenant", async () => {
    const { service, prisma } = makeHarness({ tenantId: 'SOMEONE_ELSE' });
    const { data, signature } = callback({ status: 'success', order_id: 'txn_1' });

    await service.handleEpointCallback('ten_1', data, signature);

    expect(prisma.scoped.transaction.update).not.toHaveBeenCalled();
  });
});
