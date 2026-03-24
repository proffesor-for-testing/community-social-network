import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupKeys, joinGroup, leaveGroup } from '../queries';
import type { MembershipDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface JoinGroupInput {
  groupId: string;
  leave?: boolean;
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<MembershipDto | void, ApiError, JoinGroupInput>({
    mutationFn: ({ groupId, leave }) =>
      leave ? leaveGroup(groupId) : joinGroup(groupId),
    onSuccess: (_data, { leave }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      addToast(leave ? 'Left group' : 'Joined group!', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
