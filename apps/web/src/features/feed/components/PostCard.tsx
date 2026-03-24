import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Button } from '../../../shared/components/atoms/Button';
import { ReactionBar } from './ReactionBar';
import { useDeletePost } from '../hooks/useDeletePost';
import { useAuthStore } from '../../../stores/auth.store';
import type { PublicationDto } from '../../../api/types';

interface PostCardProps {
  post: PublicationDto;
}

export function PostCard({ post }: PostCardProps) {
  const currentUser = useAuthStore((s) => s.user);
  const deleteMutation = useDeletePost();
  const isOwner = currentUser?.id === post.authorId;

  const timeAgo = formatTimeAgo(post.createdAt);

  return (
    <article className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.authorId}`}>
            <Avatar
              src={post.authorAvatarUrl}
              alt={post.authorName}
              size="md"
            />
          </Link>
          <div>
            <Link
              to={`/profile/${post.authorId}`}
              className="text-sm font-semibold text-gray-900 hover:underline dark:text-gray-100"
            >
              {post.authorName}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {post.type === 'article' && (
            <Badge variant="info" size="sm">Article</Badge>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate(post.id)}
              loading={deleteMutation.isPending}
              aria-label="Delete post"
            >
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <Link
          to={`/posts/${post.id}`}
          className="block text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100"
        >
          {post.title}
        </Link>
      )}

      {/* Body */}
      <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
        {post.body}
      </p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
        <ReactionBar publicationId={post.id} reactionCount={post.reactionCount} />

        <Link
          to={`/posts/${post.id}`}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
            />
          </svg>
          {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
        </Link>
      </div>
    </article>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
