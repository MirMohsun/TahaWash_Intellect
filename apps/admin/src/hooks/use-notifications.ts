import { useQuery } from '@tanstack/react-query';
import { fetchTenantNotifications, type TenantNotification } from '@/lib/notifications-api';

/**
 * 60s refetch interval so the bell picks up the day-rollover lifecycle
 * (subscription crossing T-1 → T-0) without the user reloading the page.
 */
export function useTenantNotifications() {
  return useQuery<TenantNotification[]>({
    queryKey: ['tenant-notifications'],
    queryFn: fetchTenantNotifications,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
