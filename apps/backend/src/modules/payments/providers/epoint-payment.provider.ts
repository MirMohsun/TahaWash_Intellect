import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import { encodeData, generateSignature } from '../epoint/epoint-signature.util';
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
 * Real ePoint.az payment provider.
 *
 * Every call POSTs `application/x-www-form-urlencoded` with two fields —
 * `data` (base64 JSON) + `signature` (verified scheme, see epoint-signature) —
 * to `${EPOINT_BASE_URL}<endpoint>`, signed with the calling TENANT's
 * private_key. Responses are JSON; we normalize them to `PaymentProviderResult`.
 *
 * Failure semantics:
 *   - Transport / non-2xx / unparseable body → throw ServiceUnavailableException
 *     (the request never reached a business outcome — caller can retry/surface).
 *   - A valid ePoint response with `status: "error"` (declined, bad card, etc.)
 *     is NOT an exception — it's a normal result with `ok: false`.
 *
 * Security: the tenant `private_key` is used only to compute the signature and
 * is NEVER logged. We log endpoint + ePoint status + trace_id only.
 */
@Injectable()
export class EpointProvider implements PaymentProvider {
  private readonly logger = new Logger(EpointProvider.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('EPOINT_BASE_URL', { infer: true });
  }

  async createPayment(
    creds: MerchantCredentials,
    p: CreatePaymentParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post('/request', creds, this.paymentPayload(p));
    return this.redirectResult(raw, 'redirect_url');
  }

  async createPaymentWithCardSave(
    creds: MerchantCredentials,
    p: CreatePaymentParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post('/card-registration-with-pay', creds, {
      ...this.paymentPayload(p),
      refund: 0,
    });
    return this.redirectResult(raw, 'redirect_url');
  }

  async registerCard(
    creds: MerchantCredentials,
    p: RegisterCardParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post(
      '/card-registration',
      creds,
      compact({
        language: p.language ?? 'az',
        description: p.description,
        refund: p.forRefund ? 1 : 0,
        success_redirect_url: p.successRedirectUrl,
        error_redirect_url: p.errorRedirectUrl,
      }),
    );
    return this.redirectResult(raw, 'redirect_url');
  }

  async chargeSavedCard(
    creds: MerchantCredentials,
    p: ChargeSavedCardParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post(
      '/execute-pay',
      creds,
      compact({
        card_id: p.cardId,
        amount: p.amount,
        order_id: p.orderId,
        description: p.description,
        currency: 'AZN',
        language: p.language ?? 'az',
      }),
    );
    return this.serverChargeResult(raw);
  }

  async createWidget(
    creds: MerchantCredentials,
    p: WidgetParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post('/token/widget', creds, {
      amount: p.amount,
      order_id: p.orderId,
      description: p.description,
    });
    return this.redirectResult(raw, 'widget_url');
  }

  async getStatus(
    creds: MerchantCredentials,
    transactionId: string,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post('/get-status', creds, { transaction: transactionId });
    const s = String(raw.status ?? '').toLowerCase();
    const status =
      s === 'success'
        ? 'success'
        : s === 'new' || s === 'pending'
          ? 'pending'
          : s === 'error' || s === 'declined' || s === 'failed'
            ? 'declined'
            : 'error';
    return { ok: s === 'success', status, ...this.extract(raw) };
  }

  async reverse(
    creds: MerchantCredentials,
    p: ReverseParams,
  ): Promise<PaymentProviderResult> {
    const raw = await this.post(
      '/reverse',
      creds,
      compact({ transaction: p.transactionId, amount: p.amount }),
    );
    return this.serverChargeResult(raw);
  }

  async refund(creds: MerchantCredentials, p: RefundParams): Promise<PaymentProviderResult> {
    const raw = await this.post(
      '/refund-request',
      creds,
      compact({
        card_id: p.cardId,
        order_id: p.orderId,
        amount: p.amount,
        currency: 'AZN',
        description: p.description,
      }),
    );
    return this.serverChargeResult(raw);
  }

  // ── internals ───────────────────────────────────────────────────

  private paymentPayload(p: CreatePaymentParams): Record<string, unknown> {
    return compact({
      amount: p.amount,
      order_id: p.orderId,
      description: p.description,
      currency: 'AZN',
      language: p.language ?? 'az',
      success_redirect_url: p.successRedirectUrl,
      error_redirect_url: p.errorRedirectUrl,
    });
  }

  /** Result shape for endpoints that return a URL to open (hosted pay / widget). */
  private redirectResult(
    raw: Record<string, unknown>,
    urlKey: 'redirect_url' | 'widget_url',
  ): PaymentProviderResult {
    const ok = raw.status === 'success';
    const url = str(raw[urlKey]);
    return {
      ok,
      status: ok ? 'redirect' : 'error',
      ...(urlKey === 'redirect_url' ? { redirectUrl: url } : { widgetUrl: url }),
      ...this.extract(raw),
    };
  }

  /** Result shape for server-to-server charges (execute-pay / reverse / refund). */
  private serverChargeResult(raw: Record<string, unknown>): PaymentProviderResult {
    const ok = raw.status === 'success';
    // A non-success server charge is most often a bank decline; the message +
    // bank_response carry the detail. (Transport errors already threw upstream.)
    return { ok, status: ok ? 'success' : 'declined', ...this.extract(raw) };
  }

  private extract(raw: Record<string, unknown>): Partial<PaymentProviderResult> {
    return {
      transactionId: str(raw.transaction),
      cardId: str(raw.card_id),
      cardMask: str(raw.card_mask),
      cardName: str(raw.card_name),
      bankResponse: str(raw.bank_response),
      message: str(raw.message),
      traceId: str(raw.trace_id),
      raw,
    };
  }

  /**
   * Sign + POST a payload to ePoint. Injects the tenant's public_key, signs with
   * its private_key, and returns the parsed JSON. Throws on transport/HTTP/parse
   * failure only — a `status:"error"` body is returned for the caller to map.
   */
  private async post(
    endpoint: string,
    creds: MerchantCredentials,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const body = { public_key: creds.publicKey, ...payload };
    const data = encodeData(body);
    const signature = generateSignature(data, creds.privateKey);
    const form = new URLSearchParams({ data, signature }).toString();
    const url = this.baseUrl + endpoint;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: form,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`ePoint ${endpoint} unreachable: ${reason}`);
      throw new ServiceUnavailableException({
        code: 'EPOINT_UNREACHABLE',
        message: `Could not reach the payment gateway: ${reason}`,
      });
    }

    const text = await res.text().catch(() => '');
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.logger.error(`ePoint ${endpoint} non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
      throw new ServiceUnavailableException({
        code: `EPOINT_BAD_RESPONSE`,
        message: `Payment gateway returned HTTP ${res.status} with an unexpected body.`,
      });
    }

    this.logger.log(
      `ePoint ${endpoint} → status=${String(json.status ?? '?')} ` +
        `trace=${String(json.trace_id ?? '-')} http=${res.status}`,
    );
    return json;
  }
}

/** Coerce an unknown JSON value to a non-empty string, else undefined. */
function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.length > 0 ? v : undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

/** Drop keys whose value is undefined (so we don't sign null fields). */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
