import React from 'react';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { Button } from '../../../shared/components/atoms/Button';
import { PostCard } from '../../feed/components/PostCard';
import { useGroupFeed } from '../hooks/useGroupFeed';

interface GroupFeedProps {
  groupId: string;
  /** Only members may read a group feed; the API rejects everyone else. */
  enabled?: boolean;
}

export function GroupFeed({ groupId, enabled = true }: GroupFeedProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGroupFeed(groupId, enabled);

  if (!enabled) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Join this group to see its posts.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message ?? 'Failed to load group posts.'}
        </p>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  if (posts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No posts in this group yet. Start the conversation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
