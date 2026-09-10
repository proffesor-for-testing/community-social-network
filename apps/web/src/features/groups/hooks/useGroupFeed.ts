import { useInfiniteQuery } from '@tanstack/react-query';
import { groupKeys, fetchGroupPublications } from '../queries';
import type { FeedPage } from '../../feed/queries';

/**
 * Infinite-scroll feed for a single group. Disabled until the viewer is known
 * to be a member, since the endpoint rejects non-members with a 403.
 */
export function useGroupFeed(groupId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: groupKeys.posts(groupId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchGroupPublications(groupId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && !!groupId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
