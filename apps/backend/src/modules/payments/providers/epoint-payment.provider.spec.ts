import { decodeData, verifySignature } from '../epoint/epoint-signature.util';
import type { MerchantCredentials } from '../payment.types';
import { EpointProvider } from './epoint-payment.provider';

/**
 * Verifies the REAL ePoint client end-to-end without touching the network:
 * `fetch` is mocked, and we assert the provider POSTs a genuinely-signed request
 * to the correct endpoint and normalizes the response. The signature is checked
 * with the same verify function ePoint would use.
 */
describe('EpointProvider', () => {
  const BASE = 'https://epoint.az/api/1';
  const creds: MerchantCredentials = { publicKey: 'i000000001', privateKey: 'test-private-key' };

  const realFetch = global.fetch;
  let provider: EpointProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // EpointProvider only reads EPOINT_BASE_URL from config.
    provider = new EpointProvider({ get: () => BASE } as never);
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  afterAll(() => {
    (global as { fetch: unknown }).fetch = realFetch;
  });

  function respondWith(json: Record<string, unknown>, httpStatus = 200): void {
    fetchMock.mockResolvedValue({
      ok: httpStatus < 400,
      status: httpStatus,
      text: async () => JSON.stringify(json),
    });
  }

  function lastCall(): {
    url: string;
    opts: { method: string; headers: Record<string, string>; body: string };
    data: string;
    signature: string;
    payload: Record<string, unknown>;
  } {
    const [url, opts] = fetchMock.mock.calls[0] as [string, never];
    const o = opts as { method: string; headers: Record<string, string>; body: string };
    const params = new URLSearchParams(o.body);
    const data = params.get('data') as string;
    const signature = params.get('signature') as string;
    return { url, opts: o, data, signature, payload: decodeData(data) };
  }

  it('createPayment posts a correctly-signed request to /request and maps redirect_url', async () => {
    respondWith({
      status: 'success',
      redirect_url: 'https://epoint.az/pay/abc',
      transaction: 'te_1',
      trace_id: 'tr_1',
    });

    const res = await provider.createPayment(creds, {
      orderId: 'ORDER-1',
      amount: '2.50',
      description: 'Wash',
    });

    const { url, opts, data, signature, payload } = lastCall();
    expect(url).toBe(`${BASE}/request`);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toContain('x-www-form-urlencoded');
    // public_key injected + fields mapped correctly
    expect(payload).toMatchObject({
      public_key: 'i000000001',
      order_id: 'ORDER-1',
      amount: '2.50',
      currency: 'AZN',
    });
    // the signature is genuine for this exact data + the tenant's private key
    expect(verifySignature(data, signature, creds.privateKey)).toBe(true);
    // response normalized
    expect(res).toMatchObject({
      ok: true,
      status: 'redirect',
      redirectUrl: 'https://epoint.az/pay/abc',
      transactionId: 'te_1',
      traceId: 'tr_1',
    });
  });

  it('chargeSavedCard posts to /execute-pay with card_id and maps success', async () => {
    respondWith({ status: 'success', transaction: 'te_2', card_mask: '411111******1111' });

    const res = await provider.chargeSavedCard(creds, {
      cardId: 'card_abc',
      orderId: 'ORDER-2',
      amount: '5.00',
      description: 'Wash',
    });

    const { url, payload } = lastCall();
    expect(url).toBe(`${BASE}/execute-pay`);
    expect(payload).toMatchObject({ card_id: 'card_abc', order_id: 'ORDER-2', amount: '5.00' });
    expect(res).toMatchObject({
      ok: true,
      status: 'success',
      transactionId: 'te_2',
      cardMask: '411111******1111',
    });
  });

  it('maps a declined saved-card charge to status=declined (no throw)', async () => {
    respondWith({ status: 'error', message: 'Insufficient funds', bank_response: '116' });

    const res = await provider.chargeSavedCard(creds, {
      cardId: 'c',
      orderId: 'O',
      amount: '1.00',
      description: 'x',
    });

    expect(res).toMatchObject({
      ok: false,
      status: 'declined',
      message: 'Insufficient funds',
      bankResponse: '116',
    });
  });

  it('createWidget posts to /token/widget and maps widget_url', async () => {
    respondWith({ status: 'success', widget_url: 'https://epoint.az/widget/xyz' });

    const res = await provider.createWidget(creds, {
      orderId: 'O',
      amount: '3.00',
      description: 'Apple Pay',
    });

    expect(lastCall().url).toBe(`${BASE}/token/widget`);
    expect(res).toMatchObject({
      ok: true,
      status: 'redirect',
      widgetUrl: 'https://epoint.az/widget/xyz',
    });
  });

  it('throws when the gateway is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      provider.createPayment(creds, { orderId: 'O', amount: '1.00', description: 'x' }),
    ).rejects.toThrow();
  });

  it('throws when the gateway returns a non-JSON body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>Bad Gateway</html>',
    });
    await expect(provider.getStatus(creds, 'te_1')).rejects.toThrow();
  });
});
