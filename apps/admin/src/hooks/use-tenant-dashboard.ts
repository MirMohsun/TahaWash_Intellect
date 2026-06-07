import { useQuery } from '@tanstack/react-query';
import { fetchTenantDashboard, type TenantDashboardData } from '@/lib/dashboard-api';

/**
 * Dashboard rollup hook. 30s staleTime matches the global default in main.tsx —
 * a tenant refreshing the page mid-shift sees near-real-time KPIs, but we
 * don't refetch on every focus event.
 */
export function useTenantDashboard() {
  return useQuery<TenantDashboardData>({
    queryKey: ['tenant-dashboard'],
    queryFn: fetchTenantDashboard,
  });
}
