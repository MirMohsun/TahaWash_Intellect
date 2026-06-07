import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationsResponse,
} from '../lib/notifications-api';

const NOTIFICATIONS_KEY = ['notifications'] as const;

/**
 * The customer's in-app notifications + unread count. Shared by the Main-tab
 * bell (reads `unreadCount` for the badge) and the notifications screen
 * (renders `items`) — react-query dedupes the single request.
 */
export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: listNotifications,
  });
}

/** Mark every notification read (called when the screen opens → clears the badge). */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
