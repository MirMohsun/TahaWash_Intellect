import { api } from './api';

/**
 * Typed wrappers for the customer-facing /me/transactions endpoints
 * (Phase 1.6). All require a valid customer JWT.
 */

export type CustomerTxStatus =
  | 'pending'
  | 'paid_crediting'
  | 'paid_credited'
  | 'paid_hardware_error'
  | 'declined'
  | 'cancelled';

export type CustomerTxPaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type CustomerTxCardBrand = 'visa' | 'mastercard' | 'unionpay' | 'maestro' | 'unknown';

export interface CustomerTx {
  id: string;
  amountAzn: string;
  status: CustomerTxStatus;
  paymentMethod: CustomerTxPaymentMethod | null;
  cardBrand: CustomerTxCardBrand | null;
  cardLastFour: string | null;
  ePointReference: string | null;
  hardwareCreditedAt: string | null;
  errorReason: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    brandName: string;
    logoUrl: string | null;
    themeColor: string;
  };
  location: {
    id: string;
    name: string;
    address: string;
  };
  bay: {
    id: string;
    name: string;
  };
}

export interface ListTxResponse {
  items: CustomerTx[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listMyTransactions(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<ListTxResponse> {
  const res = await api.get<ListTxResponse>('/me/transactions', { params: opts ?? {} });
  return res.data;
}

export async function getMyTransaction(id: string): Promise<CustomerTx> {
  const res = await api.get<CustomerTx>(`/me/transactions/${id}`);
  return res.data;
}
