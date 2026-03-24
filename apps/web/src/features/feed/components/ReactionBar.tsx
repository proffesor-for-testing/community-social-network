import React from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { useReaction } from '../hooks/useReaction';
import type { ReactionType } from '../queries';

interface ReactionBarProps {
  publicationId: string;
  reactionCount: number;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '\uD83D\uDC4D', label: 'Like' },
  { type: 'love', emoji: '\u2764\uFE0F', label: 'Love' },
  { type: 'laugh', emoji: '\uD83D\uDE02', label: 'Laugh' },
  { type: 'wow', emoji: '\uD83D\uDE2E', label: 'Wow' },
  { type: 'sad', emoji: '\uD83D\uDE22', label: 'Sad' },
  { type: 'angry', emoji: '\uD83D\uDE21', label: 'Angry' },
];

export function ReactionBar({ publicationId, reactionCount }: ReactionBarProps) {
  const reactionMutation = useReaction();

  const handleReaction = (type: ReactionType) => {
    reactionMutation.mutate({ publicationId, type });
  };

  return (
    <div className="flex items-center gap-1">
      {REACTIONS.map(({ type, emoji, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => handleReaction(type)}
          disabled={reactionMutation.isPending}
          aria-label={label}
          title={label}
          className="rounded-full px-2 py-1 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-surface-dark-tertiary"
        >
          {emoji}
        </button>
      ))}
      {reactionCount > 0 && (
        <span className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          {reactionCount}
        </span>
      )}
    </div>
  );
}
