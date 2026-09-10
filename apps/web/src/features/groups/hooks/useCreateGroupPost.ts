import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupKeys, createGroupPublication } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useCreateGroupPost(groupId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<{ id: string }, ApiError, string>({
    mutationFn: (content: string) => createGroupPublication(groupId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.posts(groupId) });
      addToast('Post created!', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
