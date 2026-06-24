import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createPayment,
  getPaymentStatus,
  mockCompletePayment,
  type CreatePaymentRequest,
  type PaymentStatusResponse,
} from '../lib/payments-api';

/** Statuses at which polling should stop — the payment has a final outcome. */
const SETTLED = new Set([
  'paid_crediting', // bank approved (success-for-now; hardware credit is a later phase)
  'paid_credited',
  'paid_hardware_error',
  'declined',
  'cancelled',
]);

export function isSettled(status: string | undefined): boolean {
  return Boolean(status && SETTLED.has(status));
}

export function useCreatePayment() {
  return useMutation({ mutationFn: (req: CreatePaymentRequest) => createPayment(req) });
}

/**
 * Polls a transaction's status every 1.5s until it settles, then stops.
 * Pass `enabled: false` while a WebView is still open.
 */
export function usePaymentStatus(id: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery<PaymentStatusResponse>({
    queryKey: ['payment-status', id],
    queryFn: () => getPaymentStatus(id as string),
    enabled: Boolean(id) && (opts?.enabled ?? true),
    refetchInterval: (query) => (isSettled(query.state.data?.status) ? false : 1500),
  });
}

export function useMockCompletePayment() {
  return useMutation({ mutationFn: (id: string) => mockCompletePayment(id) });
}
