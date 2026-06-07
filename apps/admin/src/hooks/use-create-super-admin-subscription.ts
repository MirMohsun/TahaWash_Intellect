import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type CreateSubscriptionInput,
  type CreateSubscriptionResponse,
  createSuperAdminSubscription,
} from '@/lib/super-admin-api';

/**
 * Records a manual subscription payment for a tenant. On success
 * invalidates:
 *   - the subscriptions list (so the new row shows up)
 *   - the tenant detail (so the renewed subscriptionEnd surfaces)
 *   - the tenants list (so the SubscriptionPill column updates)
 *   - the platform dashboard (so MRR + watchlist update)
 *   - the tenant-activity feed on the 4.5 detail page (audit row landed)
 */
export function useCreateSuperAdminSubscription(tenantId: string) {
  const qc = useQueryClient();
  return useMutation<CreateSubscriptionResponse, unknown, CreateSubscriptionInput>({
    mutationFn: (payload) => createSuperAdminSubscription(tenantId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['super-admin-subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['super-admin-tenant', tenantId] });
      void qc.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      void qc.invalidateQueries({ queryKey: ['super-admin-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['super-admin-tenant-activity', tenantId] });
    },
  });
}
