import { RequestContext } from '../../common/request-context';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';

// withBypass just needs to run the callback in these unit tests.
jest.spyOn(RequestContext, 'withBypass').mockImplementation((fn: () => unknown) => fn() as never);

type Txn = { id: string; status: string; amountAzn: string; [k: string]: unknown };

function makeHarness(opts?: { card?: Record<string, unknown> | null; bay?: Record<string, unknown> }) {
  const txns: Txn[] = [];
  let n = 0;

  const activeBay = {
    id: 'bay_1',
    locationId: 'loc_1',
    name: 'Bay 1',
    status: 'active',
    location: { id: 'loc_1', status: 'active', deletedAt: null },
    tenant: {
      id: 'ten_1',
      brandName: 'YuBox',
      status: 'active',
      deletedAt: null,
      minChargeAmount: '1.00',
      chargeStep: '0.50',
      ePointMerchantId: 'i000000001',
      ePointPrivateKeyEnc: 'enc',
    },
    ...opts?.bay,
  };

  const prisma = {
    scoped: {
      bay: { findUnique: jest.fn().mockResolvedValue(activeBay) },
      savedCard: {
        findUnique: jest.fn().mockResolvedValue(
          opts && 'card' in opts
            ? opts.card
            : { id: 'card_1', tenantId: 'ten_1', ePointToken: 'tok_abc', brand: 'visa', lastFour: '4242' },
        ),
      },
      transaction: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const t: Txn = { id: `txn_${++n}`, amountAzn: String(data.amountAzn), ...data } as Txn;
          txns.push(t);
          return { id: t.id };
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const t = txns.find((x) => x.id === where.id)!;
          Object.assign(t, data);
          return t;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => txns.find((x) => x.id === where.id) ?? null),
      },
    },
  };

  const config = {
    get: (k: string) => (k === 'PAYMENT_PROVIDER' ? 'mock' : 'https://app.tahawash.az'),
  };
  const cipher = { decrypt: jest.fn(() => 'k'), encrypt: jest.fn(), isConfigured: () => true };

  const service = new PaymentsService(
    prisma as never,
    config as never,
    cipher as never,
    new MockPaymentProvider(),
  );
  return { service, prisma, txns };
}

const dto = (over: Partial<CreatePaymentDto>): CreatePaymentDto =>
  ({ qrShortId: 'ABC123', amount: '2.50', method: 'new_card', ...over }) as CreatePaymentDto;

describe('PaymentsService', () => {
  it('saved-card charge → authorized + transaction set to paid_crediting', async () => {
    const { service, txns } = makeHarness();
    const res = await service.createPayment('cust_1', dto({ method: 'saved_card', cardId: 'card_1' }));

    expect(res.status).toBe('authorized');
    expect(res.transactionId).toBeTruthy();
    expect(txns[0]!.status).toBe('paid_crediting');
    expect(txns[0]!.customerId).toBe('cust_1');
    expect(txns[0]!.tenantId).toBe('ten_1');
  });

  it('new-card → redirect with a redirectUrl; transaction stays pending', async () => {
    const { service, txns } = makeHarness();
    const res = await service.createPayment('cust_1', dto({ method: 'new_card' }));

    expect(res.status).toBe('redirect');
    expect(res.redirectUrl).toBeTruthy();
    expect(txns[0]!.status).toBe('pending');
  });

  it('apple_pay → redirect with a widgetUrl', async () => {
    const { service } = makeHarness();
    const res = await service.createPayment('cust_1', dto({ method: 'apple_pay' }));

    expect(res.status).toBe('redirect');
    expect(res.widgetUrl).toBeTruthy();
  });

  it('rejects an amount below the tenant minimum', async () => {
    const { service } = makeHarness();
    await expect(service.createPayment('cust_1', dto({ amount: '0.50' }))).rejects.toMatchObject({
      response: { code: 'AMOUNT_BELOW_MIN' },
    });
  });

  it('rejects an amount not aligned to the charge step', async () => {
    const { service } = makeHarness();
    await expect(service.createPayment('cust_1', dto({ amount: '2.30' }))).rejects.toMatchObject({
      response: { code: 'AMOUNT_NOT_ALIGNED' },
    });
  });

  it("rejects a saved card that belongs to a different merchant", async () => {
    const { service } = makeHarness({
      card: { id: 'card_x', tenantId: 'OTHER_TENANT', ePointToken: 't', brand: 'visa', lastFour: '1111' },
    });
    await expect(
      service.createPayment('cust_1', dto({ method: 'saved_card', cardId: 'card_x' })),
    ).rejects.toMatchObject({ response: { code: 'CARD_WRONG_MERCHANT' } });
  });

  it('rejects a disabled bay', async () => {
    const { service } = makeHarness({ bay: { status: 'disabled' } });
    await expect(service.createPayment('cust_1', dto({}))).rejects.toMatchObject({
      response: { code: 'DEVICE_DISABLED' },
    });
  });

  it('mock-complete advances a pending redirect payment to paid_crediting', async () => {
    const { service, txns } = makeHarness();
    const res = await service.createPayment('cust_1', dto({ method: 'new_card' }));
    const done = await service.mockComplete('cust_1', res.transactionId);
    expect(done.status).toBe('paid_crediting');
    expect(txns[0]!.status).toBe('paid_crediting');
  });
});
