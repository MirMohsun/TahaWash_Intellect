import type { MerchantCredentials } from '../payment.types';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();
  const creds: MerchantCredentials = { publicKey: 'i000000001', privateKey: 'mock-secret' };

  it('chargeSavedCard succeeds immediately with a transaction + masked card', async () => {
    const res = await provider.chargeSavedCard(creds, {
      cardId: 'card_abc',
      orderId: 'ORDER-1',
      amount: '2.50',
      description: 'Wash',
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('success');
    expect(res.transactionId).toContain('ORDER-1');
    expect(res.cardMask).toBeTruthy();
  });

  it('createPayment returns a redirect URL carrying the order id', async () => {
    const res = await provider.createPayment(creds, {
      orderId: 'ORDER-2',
      amount: '5.00',
      description: 'Wash',
    });
    expect(res.status).toBe('redirect');
    expect(res.redirectUrl).toContain('order_id=ORDER-2');
  });

  it('createPaymentWithCardSave returns a redirect URL', async () => {
    const res = await provider.createPaymentWithCardSave(creds, {
      orderId: 'ORDER-3',
      amount: '5.00',
      description: 'Wash + save',
    });
    expect(res.status).toBe('redirect');
    expect(res.redirectUrl).toContain('save-card');
  });

  it('createWidget returns a widget URL (Apple/Google Pay)', async () => {
    const res = await provider.createWidget(creds, {
      orderId: 'ORDER-4',
      amount: '3.00',
      description: 'Apple Pay',
    });
    expect(res.status).toBe('redirect');
    expect(res.widgetUrl).toContain('widget');
  });

  it('getStatus, reverse, refund all resolve as mock successes', async () => {
    expect((await provider.getStatus(creds, 'te_1')).ok).toBe(true);
    expect((await provider.reverse(creds, { transactionId: 'te_1' })).ok).toBe(true);
    expect(
      (await provider.refund(creds, { cardId: 'c', orderId: 'O', amount: '1.00' })).ok,
    ).toBe(true);
  });
});
