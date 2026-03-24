import React, { useEffect, useRef } from 'react';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { Button } from '../../../shared/components/atoms/Button';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkRead, useMarkAllRead } from '../hooks/useMarkRead';

export function NotificationList() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();

  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message ?? 'Failed to load notifications.'}
        </p>
      </div>
    );
  }

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Notifications
        </h1>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="py-8 text-center text-gray-500 dark:text-gray-400">
          No notifications yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate(id)}
            />
          ))}
        </ul>
      )}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      {!hasNextPage && notifications.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
          No more notifications.
        </p>
      )}
    </div>
  );
}
