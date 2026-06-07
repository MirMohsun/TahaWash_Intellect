import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchSuperAdminSubscriptions,
  type ListSubscriptionsParams,
  type SuperAdminSubscriptionsResponse,
} from '@/lib/super-admin-api';

/**
 * Cross-tenant subscription payment log. `keepPreviousData` keeps the
 * current page rendered while a new page/filter loads — same pattern
 * as the tenant transactions table.
 */
export function useSuperAdminSubscriptions(params: ListSubscriptionsParams) {
  return useQuery<SuperAdminSubscriptionsResponse>({
    queryKey: ['super-admin-subscriptions', params],
    queryFn: () => fetchSuperAdminSubscriptions(params),
    placeholderData: keepPreviousData,
  });
}
