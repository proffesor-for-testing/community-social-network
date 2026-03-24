import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from './use-socket-events';
import { useNotificationStore } from '../stores/notification.store';
import type { AlertDto } from '../api/types';

/**
 * Maps incoming Socket.IO events to TanStack Query cache invalidations
 * so the UI stays fresh without manual refetching.
 */
export function useSocketQueryInvalidation(): void {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);

  // ── Notifications ──────────────────────────────────────────────

  const handleNewNotification = useCallback(
    (data: AlertDto) => {
      addNotification(data);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [addNotification, queryClient],
  );

  useSocketEvent<AlertDto>('notification:new', handleNewNotification);

  // ── Content ────────────────────────────────────────────────────

  const handlePublicationCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['publications'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, [queryClient]);

  useSocketEvent('publication:created', handlePublicationCreated);

  const handleDiscussionCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['discussions'] });
  }, [queryClient]);

  useSocketEvent('discussion:created', handleDiscussionCreated);

  // ── Social Graph ───────────────────────────────────────────────

  const handleConnectionUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
  }, [queryClient]);

  useSocketEvent('connection:updated', handleConnectionUpdate);

  // ── Community ──────────────────────────────────────────────────

  const handleGroupUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  }, [queryClient]);

  useSocketEvent('group:updated', handleGroupUpdate);

  const handleMembershipUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['memberships'] });
  }, [queryClient]);

  useSocketEvent('membership:updated', handleMembershipUpdate);
}
