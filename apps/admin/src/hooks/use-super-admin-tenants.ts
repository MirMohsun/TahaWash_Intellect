import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchSuperAdminTenants,
  type ListTenantsParams,
  type SuperAdminTenantsListResponse,
} from '@/lib/super-admin-api';

/**
 * Tenants list hook. `keepPreviousData` keeps the current rows visible
 * while a new page / filter / search loads — prevents the empty-flash +
 * height jump (same pattern as tenant transactions table in Phase 3.12).
 */
export function useSuperAdminTenants(params: ListTenantsParams) {
  return useQuery<SuperAdminTenantsListResponse>({
    queryKey: ['super-admin-tenants', params],
    queryFn: () => fetchSuperAdminTenants(params),
    placeholderData: keepPreviousData,
  });
}
