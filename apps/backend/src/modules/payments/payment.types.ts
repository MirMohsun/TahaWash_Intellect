/**
 * Payment provider abstraction.
 *
 * Mirrors the SMS/Push/Email provider pattern: the module factory picks one
 * implementation based on PAYMENT_PROVIDER (`mock` | `epoint`) and callers
 * depend on this interface, not a concrete provider — so the real ePoint client
 * can swap in without touching the PaymentsService.
 *
 * KEY DIFFERENCE from the other providers: payments are MULTI-MERCHANT. Each
 * call carries the tenant's own `MerchantCredentials` (public_key + private_key)
 * so the charge settles to that carwash's ePoint account. The provider is
 * stateless with respect to credentials.
 */

/** DI token used to inject the active payment provider. */
export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER');

export type EpointLanguage = 'az' | 'en' | 'ru';

/** One tenant's ePoint merchant credentials, decrypted just-in-time. */
export interface MerchantCredentials {
  /** ePoint public_key (merchant id, e.g. "i000000001"). Not secret. */
  publicKey: string;
  /** ePoint private_key (secret). Decrypted per-call; never logged/returned. */
  privateKey: string;
}

export interface CreatePaymentParams {
  /** Our transaction id — sent as ePoint `order_id`. */
  orderId: string;
  /** Amount as a fixed 2-decimal string, e.g. "2.50". */
  amount: string;
  description: string;
  language?: EpointLanguage;
  /** Where ePoint redirects the customer after success/failure (we open these in a WebView). */
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
}

export interface RegisterCardParams {
  description: string;
  language?: EpointLanguage;
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
  /** Register the card for refund operations rather than payments. */
  forRefund?: boolean;
}

export interface ChargeSavedCardParams {
  /** ePoint card_id (stored on SavedCard.ePointToken). */
  cardId: string;
  orderId: string;
  amount: string;
  description: string;
  language?: EpointLanguage;
}

export interface WidgetParams {
  orderId: string;
  amount: string;
  description: string;
}

export interface ReverseParams {
  /** ePoint transaction id (te_...). */
  transactionId: string;
  /** Optional partial reverse amount; omit to void the full transaction. */
  amount?: string;
}

export interface RefundParams {
  /** card_id from the original payment. */
  cardId: string;
  orderId: string;
  amount: string;
  description?: string;
}

/**
 * Normalized payment status, decoupled from ePoint's raw `status` strings:
 *  - `redirect` : a hosted-checkout / card-registration / wallet-widget URL was
 *                 issued; the customer must complete it (we open a WebView).
 *  - `success`  : payment authorized (e.g. server-to-server saved-card charge).
 *  - `pending`  : created / not yet completed.
 *  - `declined` : the bank declined the charge.
 *  - `error`    : the request itself errored (bad params, auth, system).
 */
export type NormalizedStatus = 'redirect' | 'success' | 'pending' | 'declined' | 'error';

/** Normalized result of any provider operation. */
export interface PaymentProviderResult {
  /** True iff ePoint accepted/authorized the operation (`status === 'success'`). */
  ok: boolean;
  status: NormalizedStatus;
  /** Hosted checkout / card-registration page to open in a WebView. */
  redirectUrl?: string;
  /** Apple Pay / Google Pay widget URL to open in a WebView. */
  widgetUrl?: string;
  /** ePoint transaction id (te_...). */
  transactionId?: string;
  /** ePoint card token (card_id) — persist on SavedCard.ePointToken. */
  cardId?: string;
  /** Masked PAN, e.g. "411111******1111". */
  cardMask?: string;
  cardName?: string;
  /** Bank response code (acquirer). */
  bankResponse?: string;
  /** Human-readable message / decline reason. */
  message?: string;
  /** ePoint trace id — log it; quote it to ePoint support. */
  traceId?: string;
  /** Full raw response, for logging/debugging. */
  raw?: Record<string, unknown>;
}

/** Provider contract. All methods take the tenant's merchant credentials. */
export interface PaymentProvider {
  /** Hosted payment with a new card → returns a `redirectUrl`. (POST /request) */
  createPayment(
    creds: MerchantCredentials,
    params: CreatePaymentParams,
  ): Promise<PaymentProviderResult>;

  /** Hosted payment that ALSO saves the card → `redirectUrl`; card_id arrives in the callback. (POST /card-registration-with-pay) */
  createPaymentWithCardSave(
    creds: MerchantCredentials,
    params: CreatePaymentParams,
  ): Promise<PaymentProviderResult>;

  /** Register a card without charging → `redirectUrl`. (POST /card-registration) */
  registerCard(
    creds: MerchantCredentials,
    params: RegisterCardParams,
  ): Promise<PaymentProviderResult>;

  /** Server-to-server charge of a saved card → immediate success/declined. (POST /execute-pay) */
  chargeSavedCard(
    creds: MerchantCredentials,
    params: ChargeSavedCardParams,
  ): Promise<PaymentProviderResult>;

  /** Apple Pay / Google Pay widget → returns a `widgetUrl`. (POST /token/widget) */
  createWidget(
    creds: MerchantCredentials,
    params: WidgetParams,
  ): Promise<PaymentProviderResult>;

  /** Check a payment's status by transaction id. (POST /get-status) */
  getStatus(
    creds: MerchantCredentials,
    transactionId: string,
  ): Promise<PaymentProviderResult>;

  /** Void/cancel a transaction (same-day, no saved card needed). (POST /reverse) */
  reverse(creds: MerchantCredentials, params: ReverseParams): Promise<PaymentProviderResult>;

  /** Refund (full/partial) a prior payment by its saved card_id. (POST /refund-request) */
  refund(creds: MerchantCredentials, params: RefundParams): Promise<PaymentProviderResult>;
}
