import { useMutation, useQueryClient } from '@tanstack/react-query';
import { feedKeys, deletePublication } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useDeletePost() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, string>({
    mutationFn: deletePublication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
      addToast('Post deleted', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
