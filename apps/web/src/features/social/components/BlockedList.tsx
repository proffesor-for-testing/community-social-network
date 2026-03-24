import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useBlock } from '../hooks/useBlock';
import { socialKeys, fetchBlocked } from '../queries';
import type { ProfileDto } from '../../../api/types';

export function BlockedList() {
  const { data: blocked, isLoading, isError } = useQuery<ProfileDto[]>({
    queryKey: socialKeys.blocked(),
    queryFn: fetchBlocked,
    staleTime: 60 * 1000,
  });

  const blockMutation = useBlock();

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
        Failed to load blocked users.
      </p>
    );
  }

  if (!blocked || blocked.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No blocked users.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {blocked.map((profile) => (
        <div
          key={profile.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Avatar src={profile.avatarUrl} alt={profile.displayName} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {profile.displayName}
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              blockMutation.mutate({ memberId: profile.memberId, unblock: true })
            }
            loading={blockMutation.isPending}
          >
            Unblock
          </Button>
        </div>
      ))}
    </div>
  );
}
