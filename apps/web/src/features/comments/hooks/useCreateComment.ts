import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentKeys, createComment } from '../queries';
import { feedKeys } from '../../feed/queries';
import type { DiscussionDto, CreateDiscussionDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useCreateComment() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<DiscussionDto, ApiError, CreateDiscussionDto>({
    mutationFn: createComment,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.forPost(variables.publicationId),
      });
      // Also refresh the feed to update comment counts
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
