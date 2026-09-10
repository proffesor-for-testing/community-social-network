import React from 'react';
import { useReaction } from '../hooks/useReaction';
import { resolveReactionAction } from '../reaction-toggle';
import type { ReactionType } from '../queries';

interface ReactionBarProps {
  publicationId: string;
  reactionCount: number;
  /** The viewer's current reaction on this post (null = none). */
  viewerReaction: ReactionType | null;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '\uD83D\uDC4D', label: 'Like' },
  { type: 'love', emoji: '\u2764\uFE0F', label: 'Love' },
  { type: 'laugh', emoji: '\uD83D\uDE02', label: 'Laugh' },
  { type: 'wow', emoji: '\uD83D\uDE2E', label: 'Wow' },
  { type: 'sad', emoji: '\uD83D\uDE22', label: 'Sad' },
  { type: 'angry', emoji: '\uD83D\uDE21', label: 'Angry' },
];

export function ReactionBar({ publicationId, reactionCount, viewerReaction }: ReactionBarProps) {
  const reactionMutation = useReaction();

  const handleReaction = (type: ReactionType) => {
    reactionMutation.mutate(resolveReactionAction(publicationId, viewerReaction, type));
  };

  return (
    <div className="flex items-center gap-1">
      {REACTIONS.map(({ type, emoji, label }) => {
        const active = viewerReaction === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleReaction(type)}
            disabled={reactionMutation.isPending}
            aria-label={active ? `Remove ${label}` : label}
            aria-pressed={active}
            title={active ? `Remove ${label}` : label}
            data-testid={`reaction-${type}`}
            className={
              'rounded-full px-2 py-1 text-sm transition-colors ' +
              (active
                ? 'bg-brand-100 ring-1 ring-brand-500 dark:bg-brand-900/40'
                : 'hover:bg-gray-100 dark:hover:bg-surface-dark-tertiary')
            }
          >
            {emoji}
          </button>
        );
      })}
      {reactionCount > 0 && (
        <span className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          {reactionCount}
        </span>
      )}
    </div>
  );
}
