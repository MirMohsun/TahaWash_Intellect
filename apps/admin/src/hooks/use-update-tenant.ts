import { useMutation } from '@tanstack/react-query';
import { patchTenantMe, type TenantSelfPatch } from '@/lib/tenant-update-api';
import { useAuthStore } from '@/store/auth';

/**
 * PATCH /tenant/me + refresh the auth store's tenant snapshot on success
 * so anything that reads the snapshot (TenantThemeProvider, AppShell brand
 * name, dashboard greeting, subscription banner) re-renders with the new
 * values without a page reload.
 *
 * No TanStack Query cache invalidation needed for /tenant/me because we
 * don't query it via React Query — the auth store IS the source of truth
 * for tenant identity.
 */
export function useUpdateTenantMe() {
  const refreshTenant = useAuthStore((s) => s.refreshTenant);
  return useMutation({
    mutationFn: (patch: TenantSelfPatch) => patchTenantMe(patch),
    onSuccess: async () => {
      await refreshTenant();
    },
  });
}
