import { useQuery } from '@tanstack/react-query';
import { fetchSuperAdminDashboard, type SuperAdminDashboardResponse } from '@/lib/super-admin-api';

/**
 * Platform dashboard rollup hook. Mirrors useTenantDashboard. 60s default
 * staleTime is fine here — super-admin KPIs change at human pace (new
 * tenant signups, manual subscription log entries), not per-second tx flow.
 */
export function useSuperAdminDashboard() {
  return useQuery<SuperAdminDashboardResponse>({
    queryKey: ['super-admin-dashboard'],
    queryFn: fetchSuperAdminDashboard,
  });
}
