import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addSuperAdminFeatured,
  fetchSuperAdminFeatured,
  type ReorderFeaturedInput,
  removeSuperAdminFeatured,
  reorderSuperAdminFeatured,
  type SuperAdminFeaturedRow,
} from '@/lib/super-admin-api';

const KEY = ['super-admin-featured'] as const;

export function useSuperAdminFeatured() {
  return useQuery<SuperAdminFeaturedRow[]>({
    queryKey: KEY,
    queryFn: fetchSuperAdminFeatured,
  });
}

export function useAddSuperAdminFeatured() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (tenantId) => addSuperAdminFeatured(tenantId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Bulk reorder. Optimistic write of the new order into the list cache
 * — instant UI response. On error we restore the previous order so the
 * drag visually "snaps back". The backend response (which echoes the
 * full list) overwrites the optimistic value via onSuccess.
 */
export function useReorderSuperAdminFeatured() {
  const qc = useQueryClient();
  return useMutation<
    SuperAdminFeaturedRow[],
    unknown,
    ReorderFeaturedInput,
    { previous: SuperAdminFeaturedRow[] | undefined }
  >({
    mutationFn: (payload) => reorderSuperAdminFeatured(payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<SuperAdminFeaturedRow[]>(KEY);
      if (previous) {
        const lookup = new Map(previous.map((r) => [r.tenantId, r]));
        const reordered = payload.items
          .map((i) => {
            const existing = lookup.get(i.tenantId);
            return existing ? { ...existing, sortOrder: i.sortOrder } : null;
          })
          .filter((r): r is SuperAdminFeaturedRow => r !== null);
        qc.setQueryData(KEY, reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(KEY, ctx.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });
}

export function useRemoveSuperAdminFeatured() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (tenantId) => removeSuperAdminFeatured(tenantId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
