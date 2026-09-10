import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageKeys, markConversationRead } from '../queries';
import type { ApiError } from '../../../api/error-handler';

/**
 * Marks the open thread read. Failures stay silent: an unread badge that
 * lingers is not worth interrupting the reader with a toast.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<{ markedCount: number }, ApiError, string>({
    mutationFn: markConversationRead,
    onSuccess: (result) => {
      if (result.markedCount > 0) {
        queryClient.invalidateQueries({ queryKey: messageKeys.list() });
      }
    },
  });
}

/** Marks a conversation read once, whenever the opened thread changes. */
export function useMarkReadOnOpen(conversationId: string | undefined): void {
  const { mutate } = useMarkConversationRead();

  useEffect(() => {
    if (conversationId) {
      mutate(conversationId);
    }
  }, [conversationId, mutate]);
}
