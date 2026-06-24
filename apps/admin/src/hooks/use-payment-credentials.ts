import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deletePaymentCredentials,
  fetchPaymentCredentials,
  savePaymentCredentials,
  type PaymentCredentialStatus,
} from '@/lib/payment-credentials-api';

const KEY = ['payment-credentials'] as const;

export function usePaymentCredentials() {
  return useQuery<PaymentCredentialStatus>({ queryKey: KEY, queryFn: fetchPaymentCredentials });
}

export function useSavePaymentCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { merchantId: string; privateKey: string }) => savePaymentCredentials(body),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

export function useDeletePaymentCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentCredentials,
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
