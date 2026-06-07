import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreatePromoInput,
  createSuperAdminPromo,
  deleteSuperAdminPromo,
  fetchSuperAdminPromo,
  fetchSuperAdminPromos,
  type ListPromosParams,
  type PromoStatusKey,
  type SuperAdminPromoRow,
  type SuperAdminPromosListResponse,
  type UpdatePromoInput,
  updateSuperAdminPromo,
  updateSuperAdminPromoStatus,
} from '@/lib/super-admin-api';

const LIST_KEY = ['super-admin-promos'] as const;

export function useSuperAdminPromos(params: ListPromosParams) {
  return useQuery<SuperAdminPromosListResponse>({
    queryKey: [...LIST_KEY, params],
    queryFn: () => fetchSuperAdminPromos(params),
    placeholderData: keepPreviousData,
  });
}

export function useSuperAdminPromo(id: string | undefined) {
  return useQuery<SuperAdminPromoRow>({
    queryKey: ['super-admin-promo', id],
    queryFn: () => fetchSuperAdminPromo(id as string),
    enabled: !!id,
  });
}

export function useCreateSuperAdminPromo() {
  const qc = useQueryClient();
  return useMutation<SuperAdminPromoRow, unknown, CreatePromoInput>({
    mutationFn: (payload) => createSuperAdminPromo(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateSuperAdminPromo(id: string) {
  const qc = useQueryClient();
  return useMutation<SuperAdminPromoRow, unknown, UpdatePromoInput>({
    mutationFn: (patch) => updateSuperAdminPromo(id, patch),
    onSuccess: (row) => {
      qc.setQueryData<SuperAdminPromoRow | undefined>(['super-admin-promo', id], (prev) =>
        prev ? { ...prev, ...row } : prev,
      );
      void qc.invalidateQueries({ queryKey: ['super-admin-promo', id] });
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateSuperAdminPromoStatus(id: string) {
  const qc = useQueryClient();
  return useMutation<SuperAdminPromoRow, unknown, PromoStatusKey>({
    mutationFn: (status) => updateSuperAdminPromoStatus(id, status),
    onSuccess: (row) => {
      qc.setQueryData<SuperAdminPromoRow | undefined>(['super-admin-promo', id], (prev) =>
        prev ? { ...prev, ...row } : prev,
      );
      void qc.invalidateQueries({ queryKey: ['super-admin-promo', id] });
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteSuperAdminPromo(id: string) {
  const qc = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => deleteSuperAdminPromo(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['super-admin-promo', id] });
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
