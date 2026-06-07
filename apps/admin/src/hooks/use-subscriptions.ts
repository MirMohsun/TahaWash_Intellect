import { useQuery } from '@tanstack/react-query';
import { fetchTenantSubscriptions, type TenantSubscriptionRow } from '@/lib/subscriptions-api';

export function useTenantSubscriptions() {
  return useQuery<TenantSubscriptionRow[]>({
    queryKey: ['tenant-subscriptions'],
    queryFn: fetchTenantSubscriptions,
  });
}
