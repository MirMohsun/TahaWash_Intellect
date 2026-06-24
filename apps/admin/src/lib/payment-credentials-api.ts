import { api } from './api';

export interface PaymentCredentialStatus {
  configured: boolean;
  /** ePoint public_key (present whether or not the private key is set). */
  merchantId: string | null;
}

export async function fetchPaymentCredentials(): Promise<PaymentCredentialStatus> {
  const { data } = await api.get<PaymentCredentialStatus>('/tenant/payment-credentials');
  return data;
}

export async function savePaymentCredentials(body: {
  merchantId: string;
  privateKey: string;
}): Promise<PaymentCredentialStatus> {
  const { data } = await api.put<PaymentCredentialStatus>('/tenant/payment-credentials', body);
  return data;
}

export async function deletePaymentCredentials(): Promise<PaymentCredentialStatus> {
  const { data } = await api.delete<PaymentCredentialStatus>('/tenant/payment-credentials');
  return data;
}
