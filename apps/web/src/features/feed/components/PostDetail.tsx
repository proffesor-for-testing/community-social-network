import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { Button } from '../../../shared/components/atoms/Button';
import { ReactionBar } from './ReactionBar';
import { publicationKeys, fetchPublication } from '../queries';
import { CommentThread } from '../../comments/components/CommentThread';
import { CommentForm } from '../../comments/components/CommentForm';
import type { PublicationDto } from '../../../api/types';

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>();

  const { data: post, isLoading, isError } = useQuery<PublicationDto>({
    queryKey: publicationKeys.detail(postId!),
    queryFn: () => fetchPublication(postId!),
    enabled: !!postId,
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Post not found or failed to load.
        </p>
        <Link to="/" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to feed
      </Link>

      {/* Post */}
      <article className="card space-y-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.authorId}`}>
            <Avatar src={post.authorAvatarUrl} alt={post.authorName} size="lg" />
          </Link>
          <div>
            <Link
              to={`/profile/${post.authorId}`}
              className="font-semibold text-gray-900 hover:underline dark:text-gray-100"
            >
              {post.authorName}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(post.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          {post.type === 'article' && (
            <Badge variant="info" size="sm" className="ml-auto">Article</Badge>
          )}
        </div>

        {post.title && (
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.title}
          </h1>
        )}

        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {post.body}
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="default" size="sm">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
          <ReactionBar publicationId={post.id} reactionCount={post.reactionCount} />
        </div>
      </article>

      {/* Comments section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Comments ({post.commentCount})
        </h2>
        <CommentForm publicationId={post.id} />
        <CommentThread publicationId={post.id} />
      </div>
    </div>
  );
}
