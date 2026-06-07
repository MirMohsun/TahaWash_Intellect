import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CreatePushInput,
  createSuperAdminPush,
  fetchSuperAdminPush,
  fetchSuperAdminPushCities,
  fetchSuperAdminPushHistory,
  type PushCitiesResponse,
  type SuperAdminPushListResponse,
  type SuperAdminPushRow,
} from '@/lib/super-admin-api';

const HISTORY_KEY = ['super-admin-push-history'] as const;

export function useSuperAdminPushHistory(params: { page: number; pageSize: number }) {
  return useQuery<SuperAdminPushListResponse>({
    queryKey: [...HISTORY_KEY, params],
    queryFn: () => fetchSuperAdminPushHistory(params),
    placeholderData: keepPreviousData,
  });
}

export function useSuperAdminPushDetail(id: string | undefined) {
  return useQuery<SuperAdminPushRow>({
    queryKey: ['super-admin-push', id],
    queryFn: () => fetchSuperAdminPush(id as string),
    enabled: !!id,
    // Refetch every 30s while the campaign is still in flight — the
    // BullMQ worker writes sentAt + counts asynchronously.
    refetchInterval: (q) => (q.state.data?.status !== 'sent' ? 30_000 : false),
  });
}

export function useSuperAdminPushCities() {
  return useQuery<PushCitiesResponse>({
    queryKey: ['super-admin-push-cities'],
    queryFn: fetchSuperAdminPushCities,
    // Cities don't change often — cache 5 minutes
    staleTime: 5 * 60_000,
  });
}

export function useCreateSuperAdminPush() {
  const qc = useQueryClient();
  return useMutation<SuperAdminPushRow, unknown, CreatePushInput>({
    mutationFn: (payload) => createSuperAdminPush(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}
