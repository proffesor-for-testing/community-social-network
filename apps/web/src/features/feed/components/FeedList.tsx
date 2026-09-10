import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { PostCard } from './PostCard';
import { useFeed } from '../hooks/useFeed';

export function FeedList() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message ?? 'Failed to load feed.'}
        </p>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  if (posts.length === 0) {
    // The feed only shows the viewer's own posts and those of people they
    // follow, so an empty feed usually means "you follow nobody yet".
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Your feed is empty. It fills up with posts from the people you follow.
        </p>
        <Link
          to="/explore"
          className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Follow people to fill your feed
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      {!hasNextPage && posts.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
          You've reached the end of the feed.
        </p>
      )}
    </div>
  );
}
