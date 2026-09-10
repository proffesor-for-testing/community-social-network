import { useInfiniteQuery } from '@tanstack/react-query';
import { messageKeys, fetchMessages, type MessageThreadPage } from '../queries';

/**
 * One conversation's history, paged backwards through time. Polls every 5s so
 * an open thread picks up the other side's replies.
 */
export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: messageKeys.thread(conversationId ?? ''),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchMessages(conversationId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessageThreadPage) =>
      lastPage.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
    staleTime: 2 * 1000,
    refetchInterval: 5 * 1000,
  });
}
