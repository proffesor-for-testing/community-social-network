import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  notificationKeys,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationPage,
} from '../queries';
import { useNotificationStore } from '../../../stores/notification.store';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useMarkRead() {
  const queryClient = useQueryClient();
  const storeMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, string, { previousData: InfiniteData<NotificationPage> | undefined }>({
    mutationFn: markNotificationRead,

    // Optimistic update: immediately mark notification as read in cache
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      const previousData = queryClient.getQueryData<InfiniteData<NotificationPage>>(
        notificationKeys.list(),
      );

      queryClient.setQueryData<InfiniteData<NotificationPage>>(
        notificationKeys.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === notificationId ? { ...item, isRead: true } : item,
              ),
            })),
          };
        },
      );

      // Also update the Zustand store
      storeMarkAsRead(notificationId);

      return { previousData };
    },

    onError: (error, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(notificationKeys.list(), context.previousData);
      }
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const storeMarkAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, void>({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      storeMarkAllAsRead();
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast('All notifications marked as read', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
