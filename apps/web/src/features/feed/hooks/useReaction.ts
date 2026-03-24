import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { feedKeys, addReaction, removeReaction, type FeedPage, type ReactionType } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface ReactionInput {
  publicationId: string;
  type: ReactionType;
  remove?: boolean;
}

export function useReaction() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, ReactionInput, { previousFeed: InfiniteData<FeedPage> | undefined }>({
    mutationFn: ({ publicationId, type, remove }) =>
      remove ? removeReaction(publicationId) : addReaction(publicationId, type),

    // Optimistic update: adjust reactionCount in the feed cache
    onMutate: async ({ publicationId, remove }) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.all });
      const previousFeed = queryClient.getQueryData<InfiniteData<FeedPage>>(feedKeys.all);

      queryClient.setQueryData<InfiniteData<FeedPage>>(feedKeys.all, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === publicationId
                ? {
                    ...item,
                    reactionCount: Math.max(
                      0,
                      item.reactionCount + (remove ? -1 : 1),
                    ),
                  }
                : item,
            ),
          })),
        };
      });

      return { previousFeed };
    },

    onError: (error, _variables, context) => {
      // Roll back optimistic update
      if (context?.previousFeed) {
        queryClient.setQueryData(feedKeys.all, context.previousFeed);
      }
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}
