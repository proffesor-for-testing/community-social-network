import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminKeys,
  fetchAdminUsers,
  suspendUser,
  unsuspendUser,
  promoteUser,
  demoteUser,
} from '../queries';
import type { PaginatedResponse, CurrentUserDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useAdminUsers(page = 1, search?: string) {
  return useQuery<PaginatedResponse<CurrentUserDto>>({
    queryKey: adminKeys.users(page, search),
    queryFn: () => fetchAdminUsers(page, 20, search),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, { userId: string; unsuspend?: boolean }>({
    mutationFn: ({ userId, unsuspend }) =>
      unsuspend ? unsuspendUser(userId) : suspendUser(userId),
    onSuccess: (_data, { unsuspend }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      addToast(unsuspend ? 'User unsuspended' : 'User suspended', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}

export function usePromoteUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, ApiError, { userId: string; demote?: boolean }>({
    mutationFn: ({ userId, demote }) =>
      demote ? demoteUser(userId) : promoteUser(userId),
    onSuccess: (_data, { demote }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      addToast(
        demote ? 'Admin privileges revoked' : 'User promoted to admin',
        'success',
      );
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
