import { useQuery } from '@tanstack/react-query';
import { commentKeys, fetchComments } from '../queries';
import type { DiscussionDto } from '../../../api/types';

/**
 * Fetch all comments for a publication. The API returns a flat list;
 * the CommentThread component organizes them into a tree.
 */
export function useComments(publicationId: string) {
  return useQuery<DiscussionDto[]>({
    queryKey: commentKeys.forPost(publicationId),
    queryFn: () => fetchComments(publicationId),
    enabled: !!publicationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
