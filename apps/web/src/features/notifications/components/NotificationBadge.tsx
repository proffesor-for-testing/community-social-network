import React from 'react';
import { useNotificationStore } from '../../../stores/notification.store';
import { useUnreadCount } from '../hooks/useUnreadCount';

interface NotificationBadgeProps {
  className?: string;
}

/**
 * Badge showing unread notification count.
 * Renders nothing when count is zero.
 * Auto-refreshes via useUnreadCount polling.
 */
export function NotificationBadge({ className = '' }: NotificationBadgeProps) {
  // Trigger the polling query
  useUnreadCount();

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  if (unreadCount <= 0) return null;

  const display = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <span
      className={[
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${unreadCount} unread notifications`}
    >
      {display}
    </span>
  );
}
