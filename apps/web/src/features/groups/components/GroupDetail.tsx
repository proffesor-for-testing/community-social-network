import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useGroup } from '../hooks/useGroup';
import { useJoinGroup } from '../hooks/useJoinGroup';
import { MemberList } from './MemberList';

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data: group, isLoading, isError } = useGroup(groupId!);
  const joinMutation = useJoinGroup();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Group not found or failed to load.
        </p>
        <Link to="/communities" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
          Back to communities
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/communities"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to communities
      </Link>

      {/* Group header */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {group.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant={group.visibility === 'public' ? 'info' : 'warning'}
                size="sm"
              >
                {group.visibility}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => joinMutation.mutate({ groupId: group.id })}
              loading={joinMutation.isPending}
            >
              Join Group
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => joinMutation.mutate({ groupId: group.id, leave: true })}
              loading={joinMutation.isPending}
            >
              Leave
            </Button>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300">
          {group.description}
        </p>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Created {new Date(group.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Members */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Members
        </h2>
        <MemberList groupId={group.id} />
      </div>
    </div>
  );
}
