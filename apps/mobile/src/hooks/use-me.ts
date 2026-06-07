import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteMe,
  deleteMyPaymentMethod,
  getMe,
  listMyPaymentMethods,
  type PaymentMethod,
  updateMe,
  type UpdateMePayload,
} from '../lib/customers-api';

const ME_KEY = ['me'] as const;
const PAYMENT_METHODS_KEY = ['payment-methods'] as const;

/**
 * Fetches the current customer's profile. On boot the auth store
 * already has the customer object from verifyOtp's response, but on
 * subsequent app launches we just trust the persisted token and
 * lazy-fetch /me here. This hook is the source of truth for the
 * profile screen.
 */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: getMe,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMePayload) => updateMe(payload),
    onSuccess: (customer) => {
      qc.setQueryData(ME_KEY, customer);
    },
  });
}

export function useDeleteMe() {
  return useMutation({
    mutationFn: deleteMe,
  });
}

export function usePaymentMethods() {
  return useQuery<PaymentMethod[]>({
    queryKey: PAYMENT_METHODS_KEY,
    queryFn: listMyPaymentMethods,
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMyPaymentMethod(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
    },
  });
}
