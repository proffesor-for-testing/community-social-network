import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchExploreFeed, feedKeys } from '../features/feed/queries';
import { fetchGroups, groupKeys } from '../features/groups/queries';
import { Avatar } from '../shared/components/atoms/Avatar';
import { Spinner } from '../shared/components/atoms/Spinner';
import type { PublicationDto, GroupDto } from '../api/types';

function TrendingPostsSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: feedKeys.list('explore'),
    queryFn: () => fetchExploreFeed(),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        Nothing trending yet — be the first to post.
      </p>
    );
  }

  const sorted = [...data.items].sort(
    (a: PublicationDto, b: PublicationDto) => b.reactionCount - a.reactionCount,
  );

  return (
    <ul className="space-y-3">
      {sorted.slice(0, 10).map((post) => (
        <li
          key={post.id}
          className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-surface-dark-tertiary"
        >
          <Link to={`/posts/${post.id}`} className="block">
            <div className="flex items-center gap-2">
              <Avatar
                src={post.authorAvatarUrl}
                alt={post.authorName}
                size="sm"
              />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {post.authorName}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
              {post.body}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {post.reactionCount} {post.reactionCount === 1 ? 'reaction' : 'reactions'} · {post.commentCount}{' '}
              {post.commentCount === 1 ? 'comment' : 'comments'}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CommunitiesSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: groupKeys.list(1),
    queryFn: () => fetchGroups(1, 10),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        No communities to discover right now.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.items.map((g: GroupDto) => (
        <li
          key={g.id}
          className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-surface-dark-tertiary"
        >
          <Link to={`/communities/${g.id}`} className="block">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {g.name}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {g.description}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'} · {g.visibility}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Explore
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Discover trending content and new communities.
        </p>
      </div>

      <section aria-labelledby="trending-posts-heading">
        <h2
          id="trending-posts-heading"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          Trending posts
        </h2>
        <TrendingPostsSection />
      </section>

      <section aria-labelledby="communities-heading">
        <h2
          id="communities-heading"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          Communities to discover
        </h2>
        <CommunitiesSection />
      </section>
    </div>
  );
}
