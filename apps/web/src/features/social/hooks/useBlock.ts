import { useMutation, useQueryClient } from '@tanstack/react-query';
import { socialKeys, blockUser, unblockUser } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface BlockInput {
  memberId: string;
  unblock?: boolean;
}

export function useBlock() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, BlockInput>({
    mutationFn: ({ memberId, unblock }) =>
      unblock ? unblockUser(memberId) : blockUser(memberId),
    onSuccess: (_data, { unblock }) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.all });
      addToast(unblock ? 'User unblocked' : 'User blocked', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
