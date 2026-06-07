import { useQuery } from '@tanstack/react-query';
import {
  type AnalyticsParams,
  fetchSuperAdminAnalytics,
  type SuperAdminAnalyticsResponse,
} from '@/lib/super-admin-api';

/**
 * Platform analytics rollup. Cached by from/to range. Backend caps
 * range at 365 days; UI defaults to 90.
 */
export function useSuperAdminAnalytics(params: AnalyticsParams) {
  return useQuery<SuperAdminAnalyticsResponse>({
    queryKey: ['super-admin-analytics', params],
    queryFn: () => fetchSuperAdminAnalytics(params),
  });
}
