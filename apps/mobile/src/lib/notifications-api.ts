import { api } from './api';

/**
 * In-app notification inbox. Populated server-side when a super-admin
 * broadcast is delivered (one row per targeted customer). View-only for now
 * (no deep links). Localized strings come down in all 3 languages; the UI
 * picks via the active language.
 */
export interface AppNotification {
  id: string;
  type: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export async function listNotifications(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>('/me/notifications');
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/me/notifications/read-all');
}
