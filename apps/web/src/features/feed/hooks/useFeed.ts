import { useInfiniteQuery } from '@tanstack/react-query';
import { feedKeys, fetchFeed, type FeedPage } from '../queries';

/**
 * Infinite scroll feed query with cursor-based pagination.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: feedKeys.all,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
