import { api } from './api';

export type CreatePaymentMethod = 'saved_card' | 'new_card' | 'apple_pay' | 'google_pay';

export interface CreatePaymentRequest {
  qrShortId: string;
  /** Amount in AZN, 2-decimal string e.g. "2.50". */
  amount: string;
  method: CreatePaymentMethod;
  /** Required when method = saved_card (our SavedCard id). */
  cardId?: string;
  /** For new_card: also save the card for future one-tap. */
  saveCard?: boolean;
}

export interface CreatePaymentResponse {
  transactionId: string;
  /**
   * authorized → charged immediately (saved card); now crediting.
   * redirect   → open redirectUrl (new card) / widgetUrl (Apple/Google Pay) in a WebView.
   * declined   → refused.
   */
  status: 'authorized' | 'redirect' | 'declined';
  redirectUrl?: string;
  widgetUrl?: string;
  message?: string;
}

export interface PaymentStatusResponse {
  transactionId: string;
  /** TransactionStatus: pending | paid_crediting | paid_credited | paid_hardware_error | declined | cancelled */
  status: string;
  amountAzn: string;
  ePointReference: string | null;
  errorReason: string | null;
}

export async function createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const { data } = await api.post<CreatePaymentResponse>('/payments', req);
  return data;
}

export async function getPaymentStatus(id: string): Promise<PaymentStatusResponse> {
  const { data } = await api.get<PaymentStatusResponse>(`/payments/${id}`);
  return data;
}

/** Mock-mode only: simulate ePoint completing a redirect/widget payment. */
export async function mockCompletePayment(id: string): Promise<{ status: string }> {
  const { data } = await api.post<{ status: string }>(`/payments/${id}/mock-complete`, {});
  return data;
}
