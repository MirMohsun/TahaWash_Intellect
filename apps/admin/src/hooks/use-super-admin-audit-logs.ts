import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchSuperAdminAuditLogs,
  type ListAuditLogsParams,
  type SuperAdminAuditLogsResponse,
} from '@/lib/super-admin-api';

/**
 * Open-ended audit log query (Phase 4.17). Distinct from
 * `useSuperAdminTenantActivity` (which hard-codes resourceType='tenant'
 * + pageSize=10 for the detail-page activity feed).
 *
 * `keepPreviousData` so the table doesn't flash blank as the user
 * changes filters or pages.
 */
export function useSuperAdminAuditLogs(params: ListAuditLogsParams) {
  return useQuery<SuperAdminAuditLogsResponse>({
    queryKey: ['super-admin-audit-logs', params],
    queryFn: () => fetchSuperAdminAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}
