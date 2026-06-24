import { Injectable, Logger } from '@nestjs/common';
import type {
  ChargeSavedCardParams,
  CreatePaymentParams,
  MerchantCredentials,
  PaymentProvider,
  PaymentProviderResult,
  RefundParams,
  RegisterCardParams,
  ReverseParams,
  WidgetParams,
} from '../payment.types';

/**
 * Mock payment provider — simulates the full ePoint lifecycle in-process, with
 * NO real money and NO network. Lets us build + demo scan→pay→credit→success
 * end-to-end before live merchant credentials arrive (same pattern as the mock
 * SMS/Push providers).
 *
 * Behaviour:
 *   - Server-to-server charges (saved card / reverse / refund) "succeed"
 *     immediately — so saved-card one-tap is fully demoable on its own.
 *   - Redirect flows (new-card payment, card registration, Apple/Google-Pay
 *     widget) return a deterministic mock URL under `MOCK_BASE`. The
 *     PaymentsService (mock mode) completes those by simulating the callback.
 *
 * Everything is deterministic (ids derived from the orderId) so tests are stable.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  /** Where mock redirect/widget URLs point. The service intercepts these in mock mode. */
  private static readonly MOCK_BASE = 'https://pay.mock.tahawash/epoint';

  async createPayment(
    _creds: MerchantCredentials,
    p: CreatePaymentParams,
  ): Promise<PaymentProviderResult> {
    this.log('createPayment', p.orderId, p.amount);
    return this.redirect('checkout', p.orderId);
  }

  async createPaymentWithCardSave(
    _creds: MerchantCredentials,
    p: CreatePaymentParams,
  ): Promise<PaymentProviderResult> {
    this.log('createPaymentWithCardSave', p.orderId, p.amount);
    return this.redirect('checkout-save-card', p.orderId);
  }

  async registerCard(
    _creds: MerchantCredentials,
    _p: RegisterCardParams,
  ): Promise<PaymentProviderResult> {
    const orderId = `reg-${Date.now().toString(36)}`;
    this.log('registerCard', orderId, '-');
    return this.redirect('register-card', orderId);
  }

  async chargeSavedCard(
    _creds: MerchantCredentials,
    p: ChargeSavedCardParams,
  ): Promise<PaymentProviderResult> {
    this.log('chargeSavedCard', p.orderId, p.amount);
    return {
      ok: true,
      status: 'success',
      transactionId: `mock_te_${p.orderId}`,
      cardMask: '411111******1111',
      cardName: 'MOCK CARDHOLDER',
      bankResponse: '000',
      message: 'Approved (mock)',
      traceId: `mock_trace_${p.orderId}`,
    };
  }

  async createWidget(
    _creds: MerchantCredentials,
    p: WidgetParams,
  ): Promise<PaymentProviderResult> {
    this.log('createWidget', p.orderId, p.amount);
    return {
      ok: true,
      status: 'redirect',
      widgetUrl: `${MockPaymentProvider.MOCK_BASE}/widget?order_id=${encodeURIComponent(p.orderId)}`,
      traceId: `mock_trace_${p.orderId}`,
    };
  }

  async getStatus(
    _creds: MerchantCredentials,
    transactionId: string,
  ): Promise<PaymentProviderResult> {
    return {
      ok: true,
      status: 'success',
      transactionId,
      message: 'Success (mock)',
      traceId: `mock_trace_${transactionId}`,
    };
  }

  async reverse(
    _creds: MerchantCredentials,
    p: ReverseParams,
  ): Promise<PaymentProviderResult> {
    this.log('reverse', p.transactionId, p.amount ?? 'full');
    return {
      ok: true,
      status: 'success',
      transactionId: p.transactionId,
      message: 'Reversed (mock)',
      traceId: `mock_trace_${p.transactionId}`,
    };
  }

  async refund(_creds: MerchantCredentials, p: RefundParams): Promise<PaymentProviderResult> {
    this.log('refund', p.orderId, p.amount);
    return {
      ok: true,
      status: 'success',
      transactionId: `mock_refund_${p.orderId}`,
      message: 'Refunded (mock)',
      traceId: `mock_trace_${p.orderId}`,
    };
  }

  // ── internals ───────────────────────────────────────────────────

  private redirect(kind: string, orderId: string): PaymentProviderResult {
    return {
      ok: true,
      status: 'redirect',
      redirectUrl: `${MockPaymentProvider.MOCK_BASE}/${kind}?order_id=${encodeURIComponent(orderId)}`,
      transactionId: `mock_te_${orderId}`,
      traceId: `mock_trace_${orderId}`,
    };
  }

  private log(op: string, orderId: string, amount: string): void {
    this.logger.log(`🧪 [MOCK PAY] ${op} order=${orderId} amount=${amount}`);
  }
}
