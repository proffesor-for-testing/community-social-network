import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  feedKeys,
  publicationKeys,
  addReaction,
  removeReaction,
  type FeedPage,
} from '../queries';
import { applyReactionAction, type ReactionAction } from '../reaction-toggle';
import type { PublicationDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface Snapshot {
  previousFeed: InfiniteData<FeedPage> | undefined;
  previousPost: PublicationDto | undefined;
}

/**
 * Add / switch / remove the viewer's reaction on a post.
 * Callers build the input with `resolveReactionAction` so the toggle semantics
 * live in one pure, unit-tested place.
 */
export function useReaction() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, ReactionAction, Snapshot>({
    mutationFn: ({ publicationId, type, remove }) =>
      remove ? removeReaction(publicationId, type) : addReaction(publicationId, type),

    // Optimistic update in both the feed list cache and the post detail cache.
    onMutate: async (action) => {
      const detailKey = publicationKeys.detail(action.publicationId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKeys.all }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);
      const previousFeed = queryClient.getQueryData<InfiniteData<FeedPage>>(feedKeys.all);
      const previousPost = queryClient.getQueryData<PublicationDto>(detailKey);

      queryClient.setQueryData<InfiniteData<FeedPage>>(feedKeys.all, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => applyReactionAction(item, action)),
          })),
        };
      });
      queryClient.setQueryData<PublicationDto>(detailKey, (old) =>
        old ? applyReactionAction(old, action) : old,
      );

      return { previousFeed, previousPost };
    },

    onError: (error, action, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.all, context.previousFeed);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(publicationKeys.detail(action.publicationId), context.previousPost);
      }
      addToast(parseApiError(error).message, 'error');
    },

    onSettled: (_data, _err, action) => {
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
      queryClient.invalidateQueries({ queryKey: publicationKeys.detail(action.publicationId) });
    },
  });
}
