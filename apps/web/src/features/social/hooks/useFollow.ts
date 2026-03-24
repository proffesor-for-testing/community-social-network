import { useMutation, useQueryClient } from '@tanstack/react-query';
import { socialKeys, sendFollowRequest, unfollowUser } from '../queries';
import type { ConnectionDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

interface FollowInput {
  memberId: string;
  unfollow?: boolean;
}

export function useFollow() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ConnectionDto | void, ApiError, FollowInput, { previousStatus: ConnectionDto | null | undefined }>({
    mutationFn: ({ memberId, unfollow }) =>
      unfollow
        ? unfollowUser(memberId)
        : sendFollowRequest({ addresseeId: memberId }),

    // Optimistic update: immediately update the connection status cache
    onMutate: async ({ memberId, unfollow }) => {
      await queryClient.cancelQueries({
        queryKey: socialKeys.connectionStatus(memberId),
      });
      const previousStatus = queryClient.getQueryData<ConnectionDto | null>(
        socialKeys.connectionStatus(memberId),
      );

      if (unfollow) {
        queryClient.setQueryData(socialKeys.connectionStatus(memberId), null);
      } else {
        queryClient.setQueryData(socialKeys.connectionStatus(memberId), {
          id: 'optimistic',
          requesterId: '',
          addresseeId: memberId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        } satisfies ConnectionDto);
      }

      return { previousStatus };
    },

    onError: (error, { memberId }, context) => {
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(
          socialKeys.connectionStatus(memberId),
          context.previousStatus,
        );
      }
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },

    onSettled: (_data, _error, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.all });
    },
  });
}
