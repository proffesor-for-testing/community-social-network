import type { PublicationDto } from '../../api/types';
import type { ReactionType } from './queries';

/**
 * Pure decision logic for a click on a reaction button.
 *
 * - Clicking the reaction you already left removes it.
 * - Clicking a different reaction switches to it (row count unchanged).
 * - Clicking when you have none adds it.
 */
export interface ReactionAction {
  publicationId: string;
  type: ReactionType;
  remove: boolean;
  /** Change to the total reaction count the viewer will observe. */
  countDelta: -1 | 0 | 1;
  /** The viewerReaction to display after the action. */
  nextViewerReaction: ReactionType | null;
}

export function resolveReactionAction(
  publicationId: string,
  current: ReactionType | null | undefined,
  clicked: ReactionType,
): ReactionAction {
  if (current === clicked) {
    return { publicationId, type: clicked, remove: true, countDelta: -1, nextViewerReaction: null };
  }
  return {
    publicationId,
    type: clicked,
    remove: false,
    countDelta: current ? 0 : 1,
    nextViewerReaction: clicked,
  };
}

/** Apply an action optimistically to a cached publication (immutable). */
export function applyReactionAction(post: PublicationDto, action: ReactionAction): PublicationDto {
  if (post.id !== action.publicationId) return post;
  return {
    ...post,
    reactionCount: Math.max(0, post.reactionCount + action.countDelta),
    viewerReaction: action.nextViewerReaction,
  };
}
