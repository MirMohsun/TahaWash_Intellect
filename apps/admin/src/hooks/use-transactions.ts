import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchTenantTransactions,
  type TenantTransactionsFilters,
  type TenantTransactionsListResponse,
} from '@/lib/transactions-api';

/**
 * `keepPreviousData` is important here: when the user clicks "Next page"
 * or changes a filter, we keep showing the current rows while the new
 * page loads. Without it the table flashes empty + the table heights
 * jump, which is jarring at scale.
 */
export function useTenantTransactions(filters: TenantTransactionsFilters) {
  return useQuery<TenantTransactionsListResponse>({
    queryKey: ['tenant-transactions', filters],
    queryFn: () => fetchTenantTransactions(filters),
    placeholderData: keepPreviousData,
  });
}
