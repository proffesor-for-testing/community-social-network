import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentKeys, addCommentReaction, removeCommentReaction } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface CommentReactionInput {
  commentId: string;
  publicationId: string;
  type: string;
  remove?: boolean;
}

export function useCommentReaction() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, CommentReactionInput>({
    mutationFn: ({ commentId, type, remove }) =>
      remove ? removeCommentReaction(commentId) : addCommentReaction(commentId, type),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.forPost(variables.publicationId),
      });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
