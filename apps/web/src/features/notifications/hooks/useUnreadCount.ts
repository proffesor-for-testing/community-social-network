import { useQuery } from '@tanstack/react-query';
import { notificationKeys, fetchUnreadCount } from '../queries';
import { useNotificationStore } from '../../../stores/notification.store';

/**
 * Auto-refreshing unread notification count.
 * Polls every 30 seconds and syncs with the Zustand store.
 */
export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useQuery<{ count: number }>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    select: (data) => {
      setUnreadCount(data.count);
      return data;
    },
  });
}
