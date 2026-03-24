import { create } from 'zustand';
import type { AlertDto } from '../api/types';

interface NotificationState {
  /** Unread notifications received via Socket.IO */
  notifications: AlertDto[];
  /** Unread count badge value */
  unreadCount: number;

  addNotification: (alert: AlertDto) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setNotifications: (alerts: AlertDto[]) => void;
  setUnreadCount: (count: number) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (alert) =>
    set((s) => ({
      notifications: [alert, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    })),

  markAsRead: (id) =>
    set((s) => {
      const wasUnread = s.notifications.find((n) => n.id === id && !n.isRead);
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: wasUnread
          ? Math.max(0, s.unreadCount - 1)
          : s.unreadCount,
      };
    }),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  setNotifications: (alerts) =>
    set({
      notifications: alerts,
      unreadCount: alerts.filter((a) => !a.isRead).length,
    }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));
