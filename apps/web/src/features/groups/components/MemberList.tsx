import React, { useState } from 'react';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useGroupMembers } from '../hooks/useGroupMembers';

interface MemberListProps {
  groupId: string;
}

const roleBadgeVariant: Record<string, 'default' | 'info' | 'warning'> = {
  member: 'default',
  moderator: 'info',
  admin: 'warning',
};

export function MemberList({ groupId }: MemberListProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useGroupMembers(groupId, page);

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
        Failed to load members.
      </p>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No members yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.items.map((membership) => (
        <div
          key={membership.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Avatar alt={membership.memberId} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {membership.memberId}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Joined {new Date(membership.joinedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge
            variant={roleBadgeVariant[membership.role] ?? 'default'}
            size="sm"
          >
            {membership.role}
          </Badge>
        </div>
      ))}

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
