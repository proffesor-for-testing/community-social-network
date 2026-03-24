import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { CommentForm } from './CommentForm';
import type { DiscussionDto } from '../../../api/types';

interface CommentItemProps {
  comment: DiscussionDto;
  children?: React.ReactNode;
  depth?: number;
}

export function CommentItem({ comment, children, depth = 0 }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const maxDepth = 4;

  const timeAgo = formatTimeAgo(comment.createdAt);

  return (
    <div
      className={[
        'relative',
        depth > 0 ? 'ml-6 border-l-2 border-gray-100 pl-4 dark:border-gray-700' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex gap-3 py-3">
        <Link to={`/profile/${comment.authorId}`} className="shrink-0">
          <Avatar
            src={comment.authorAvatarUrl}
            alt={comment.authorName}
            size="sm"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${comment.authorId}`}
              className="text-sm font-semibold text-gray-900 hover:underline dark:text-gray-100"
            >
              {comment.authorName}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {timeAgo}
            </span>
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {comment.body}
          </p>

          <div className="mt-1 flex items-center gap-3">
            {comment.reactionCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {comment.reactionCount} {comment.reactionCount === 1 ? 'reaction' : 'reactions'}
              </span>
            )}
            {depth < maxDepth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReply((prev) => !prev)}
                className="text-xs"
              >
                Reply
              </Button>
            )}
          </div>

          {showReply && (
            <div className="mt-2">
              <CommentForm
                publicationId={comment.publicationId}
                parentId={comment.id}
                onSuccess={() => setShowReply(false)}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {children}
    </div>
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
