import { useInfiniteQuery } from '@tanstack/react-query';
import { notificationKeys, fetchNotifications, type NotificationPage } from '../queries';

/**
 * Infinite scroll notifications query with cursor-based pagination.
 */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: [...notificationKeys.list()],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: NotificationPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
