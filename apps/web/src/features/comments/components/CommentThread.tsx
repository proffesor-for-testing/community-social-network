import React from 'react';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { CommentItem } from './CommentItem';
import { useComments } from '../hooks/useComments';
import type { DiscussionDto } from '../../../api/types';

interface CommentThreadProps {
  publicationId: string;
}

/** Organizes a flat list of comments into a threaded tree */
function buildTree(comments: DiscussionDto[]): Map<string | null, DiscussionDto[]> {
  const grouped = new Map<string | null, DiscussionDto[]>();
  for (const comment of comments) {
    const parentKey = comment.parentId ?? null;
    const children = grouped.get(parentKey) ?? [];
    children.push(comment);
    grouped.set(parentKey, children);
  }
  return grouped;
}

function renderComments(
  tree: Map<string | null, DiscussionDto[]>,
  parentId: string | null,
  depth: number,
): React.ReactNode {
  const children = tree.get(parentId);
  if (!children || children.length === 0) return null;

  return children.map((comment) => (
    <CommentItem key={comment.id} comment={comment} depth={depth}>
      {renderComments(tree, comment.id, depth + 1)}
    </CommentItem>
  ));
}

export function CommentThread({ publicationId }: CommentThreadProps) {
  const { data: comments, isLoading, isError } = useComments(publicationId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load comments.
        </p>
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No comments yet. Start the conversation!
      </p>
    );
  }

  const tree = buildTree(comments);

  return <div className="space-y-1">{renderComments(tree, null, 0)}</div>;
}
