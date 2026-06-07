import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSuperAdminAuditLogs,
  fetchSuperAdminTenant,
  type ListAuditLogsParams,
  type SuperAdminAuditLogsResponse,
  type SuperAdminTenantDetail,
  type TenantStatusKey,
  type UpdateTenantInput,
  updateSuperAdminTenant,
  updateSuperAdminTenantStatus,
} from '@/lib/super-admin-api';

/** Tenant detail with user + counts. */
export function useSuperAdminTenant(id: string | undefined) {
  return useQuery<SuperAdminTenantDetail>({
    queryKey: ['super-admin-tenant', id],
    queryFn: () => fetchSuperAdminTenant(id as string),
    enabled: !!id,
  });
}

/** Diff-only PATCH wrapper. Invalidates detail + list on success. */
export function useUpdateSuperAdminTenant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTenantInput) => updateSuperAdminTenant(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<SuperAdminTenantDetail | undefined>(['super-admin-tenant', id], (prev) =>
        prev ? { ...prev, ...updated } : prev,
      );
      void qc.invalidateQueries({ queryKey: ['super-admin-tenant', id] });
      void qc.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      void qc.invalidateQueries({ queryKey: ['super-admin-dashboard'] });
    },
  });
}

/** Status PATCH wrapper. Same invalidation set as the regular update. */
export function useUpdateSuperAdminTenantStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: TenantStatusKey) => updateSuperAdminTenantStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData<SuperAdminTenantDetail | undefined>(['super-admin-tenant', id], (prev) =>
        prev ? { ...prev, ...updated } : prev,
      );
      void qc.invalidateQueries({ queryKey: ['super-admin-tenant', id] });
      void qc.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      void qc.invalidateQueries({ queryKey: ['super-admin-dashboard'] });
    },
  });
}

/**
 * Audit-log slice for a single tenant. Hard-coded resourceType='tenant'
 * + resourceId=$id; pageSize fixed at 10 so this is a "latest 10
 * activity" feed, not a full pager.
 */
export function useSuperAdminTenantActivity(tenantId: string | undefined) {
  const params: ListAuditLogsParams = {
    resourceType: 'tenant',
    resourceId: tenantId,
    page: 1,
    pageSize: 10,
  };
  return useQuery<SuperAdminAuditLogsResponse>({
    queryKey: ['super-admin-tenant-activity', tenantId],
    queryFn: () => fetchSuperAdminAuditLogs(params),
    enabled: !!tenantId,
  });
}
