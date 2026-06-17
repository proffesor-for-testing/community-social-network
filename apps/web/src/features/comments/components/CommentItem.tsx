import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { CommentForm } from './CommentForm';
import type { DiscussionDto } from '../../../api/types';
import { useAuthStore } from '../../../stores/auth.store';
import { useToastStore } from '../../../stores/toast.store';
import { commentKeys, deleteComment, updateComment } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';

interface CommentItemProps {
  comment: DiscussionDto;
  children?: React.ReactNode;
  depth?: number;
}

export function CommentItem({ comment, children, depth = 0 }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const maxDepth = 4;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAuthor = !!currentUserId && currentUserId === comment.authorId;
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.forPost(comment.publicationId) });
      addToast('Comment deleted', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const updateMutation = useMutation<void, ApiError, string>({
    mutationFn: (content) => updateComment(comment.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.forPost(comment.publicationId) });
      addToast('Comment updated', 'success');
      setIsEditing(false);
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) return;
    deleteMutation.mutate(comment.id);
  };

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.body.trim()) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(trimmed);
  };

  const handleCancelEdit = () => {
    setDraft(comment.body);
    setIsEditing(false);
  };

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

          {isEditing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-200 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-surface-dark-secondary dark:text-gray-100"
                aria-label="Edit comment"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  loading={updateMutation.isPending}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {comment.body}
            </p>
          )}

          <div className="mt-1 flex items-center gap-3">
            {comment.reactionCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {comment.reactionCount} {comment.reactionCount === 1 ? 'reaction' : 'reactions'}
              </span>
            )}
            {depth < maxDepth && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReply((prev) => !prev)}
                className="text-xs"
              >
                Reply
              </Button>
            )}
            {isAuthor && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(comment.body);
                  setIsEditing(true);
                }}
                className="text-xs"
                aria-label="Edit comment"
              >
                Edit
              </Button>
            )}
            {isAuthor && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                aria-label="Delete comment"
              >
                Delete
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
