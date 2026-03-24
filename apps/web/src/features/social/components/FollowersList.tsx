import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { FollowButton } from './FollowButton';
import { useFollowers } from '../hooks/useFollowers';
import { useAuthStore } from '../../../stores/auth.store';

interface FollowersListProps {
  memberId: string;
}

export function FollowersList({ memberId }: FollowersListProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useFollowers(memberId, page);
  const currentUserId = useAuthStore((s) => s.user?.id);

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
        Failed to load followers.
      </p>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No followers yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.items.map((profile) => (
        <div
          key={profile.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Link to={`/profile/${profile.memberId}`}>
              <Avatar src={profile.avatarUrl} alt={profile.displayName} size="md" />
            </Link>
            <div>
              <Link
                to={`/profile/${profile.memberId}`}
                className="text-sm font-semibold text-gray-900 hover:underline dark:text-gray-100"
              >
                {profile.displayName}
              </Link>
              {profile.bio && (
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
          {currentUserId !== profile.memberId && (
            <FollowButton memberId={profile.memberId} />
          )}
        </div>
      ))}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
