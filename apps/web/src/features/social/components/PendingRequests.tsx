import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { socialKeys, fetchPendingRequests, acceptRequest, declineRequest } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';
import type { ConnectionDto } from '../../../api/types';

export function PendingRequests() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: pending, isLoading, isError } = useQuery<ConnectionDto[]>({
    queryKey: socialKeys.pending(),
    queryFn: fetchPendingRequests,
    staleTime: 30 * 1000,
  });

  const acceptMutation = useMutation<ConnectionDto, ApiError, string>({
    mutationFn: acceptRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.all });
      addToast('Request accepted', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const declineMutation = useMutation<void, ApiError, string>({
    mutationFn: declineRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.all });
      addToast('Request declined', 'info');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">
        Failed to load pending requests.
      </p>
    );
  }

  if (!pending || pending.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No pending requests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((connection) => (
        <div
          key={connection.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Avatar alt={connection.requesterId} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {connection.requesterId}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sent {new Date(connection.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => acceptMutation.mutate(connection.id)}
              loading={acceptMutation.isPending}
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => declineMutation.mutate(connection.id)}
              loading={declineMutation.isPending}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
