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

// API returns { items: [{id, recipientId, type, content:{title,body}, status, createdAt, readAt}],
// total, page, pageSize, totalPages, hasNextPage, hasPreviousPage }.
// Adapt to FE's AlertDto + cursor-based NotificationPage shape.
type ApiAlert = {
  id: string;
  recipientId: string;
  type: string;
  content: { title?: string; body?: string; actionUrl?: string };
  status: 'UNREAD' | 'READ' | string;
  createdAt: string;
  readAt: string | null;
};

type ApiNotificationsResponse = {
  items: ApiAlert[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage?: boolean;
};

export function adaptAlert(a: ApiAlert): AlertDto {
  return {
    id: a.id,
    recipientId: a.recipientId,
    type: (a.type ?? '').toLowerCase(),
    title: a.content?.title ?? '',
    body: a.content?.body ?? '',
    actionUrl: a.content?.actionUrl ?? null,
    isRead: a.status !== 'UNREAD',
    metadata: {},
    createdAt: a.createdAt,
  };
}

export async function fetchNotifications(cursor?: string): Promise<NotificationPage> {
  const params: Record<string, string> = { limit: '20' };
  if (cursor) {
    params.page = cursor;
  }
  const { data } = await apiClient.get<ApiNotificationsResponse>('/notifications', {
    params,
  });
  const nextCursor = data.hasNextPage ? String((data.page ?? 1) + 1) : null;
  return {
    items: (data.items ?? []).map(adaptAlert),
    nextCursor,
  };
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get<{ count: number }>(
    '/notifications/unread-count',
  );
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.put('/notifications/read-all');
}

// API returns { id, memberId, preferences: { TYPE: ['IN_APP', 'EMAIL', ...] } }.
// Flatten to FE's per-(channel, type) array.
type ApiPrefResponse = {
  id: string;
  memberId: string;
  preferences: Record<string, string[]>;
};

const CHANNEL_MAP: Record<string, NotificationPreferenceDto['channel']> = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
};

export async function fetchNotificationPreferences(): Promise<NotificationPreferenceDto[]> {
  const { data } = await apiClient.get<ApiPrefResponse>(
    '/notifications/preferences',
  );
  if (!data || !data.preferences) return [];
  const out: NotificationPreferenceDto[] = [];
  for (const [type, channels] of Object.entries(data.preferences)) {
    for (const channelKey of Object.keys(CHANNEL_MAP)) {
      const channel = CHANNEL_MAP[channelKey];
      const enabled = channels.includes(channelKey);
      out.push({
        id: `${type}:${channelKey}`,
        memberId: data.memberId,
        channel,
        type,
        enabled,
      });
    }
  }
  return out;
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
