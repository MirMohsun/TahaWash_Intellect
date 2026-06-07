/**
 * Tenant notifications — typed wrapper around GET /tenant/notifications.
 *
 * Notifications are derived server-side from current state (not stored
 * rows). IDs are deterministic snapshots — the client persists dismissals
 * locally; when the underlying state shifts (new day, new subscription
 * period) a new id appears and the warning resurfaces.
 */
import { api } from './api';

export type NotificationType =
  | 'subscription_expiring'
  | 'subscription_today'
  | 'subscription_expired'
  | 'tenant_suspended'
  | 'hardware_error_spike';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface TenantNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  occurredAt: string;
  data: Record<string, string>;
  link?: string;
}

export async function fetchTenantNotifications(): Promise<TenantNotification[]> {
  const { data } = await api.get<TenantNotification[]>('/tenant/notifications');
  return data;
}
