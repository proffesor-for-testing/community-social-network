import type { AlertDto, NotificationPreferenceDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// ── Cursor-based pagination response ────────────────────────────

export interface NotificationPage {
  items: AlertDto[];
  nextCursor: string | null;
}

// ── API Functions ───────────────────────────────────────────────

export async function fetchNotifications(cursor?: string): Promise<NotificationPage> {
  const params: Record<string, string> = { limit: '20' };
  if (cursor) {
    params.cursor = cursor;
  }
  const { data } = await apiClient.get<NotificationPage>('/notifications', {
    params,
  });
  return data;
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get<{ count: number }>(
    '/notifications/unread-count',
  );
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferenceDto[]> {
  const { data } = await apiClient.get<NotificationPreferenceDto[]>(
    '/notifications/preferences',
  );
  return data;
}

export async function updateNotificationPreference(
  id: string,
  enabled: boolean,
): Promise<NotificationPreferenceDto> {
  const { data } = await apiClient.patch<NotificationPreferenceDto>(
    `/notifications/preferences/${id}`,
    { enabled },
  );
  return data;
}
