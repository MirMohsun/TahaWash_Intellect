import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchTenantFinancials,
  type FinancialsData,
  type FinancialsFilters,
} from '@/lib/financials-api';

/**
 * `keepPreviousData` so the chart + leaderboards don't flash empty when
 * the user changes the date range — same UX rationale as the
 * transactions table hook.
 */
export function useTenantFinancials(filters: FinancialsFilters) {
  return useQuery<FinancialsData>({
    queryKey: ['tenant-financials', filters],
    queryFn: () => fetchTenantFinancials(filters),
    placeholderData: keepPreviousData,
  });
}
