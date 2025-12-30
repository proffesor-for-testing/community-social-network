/**
 * Reaction Types
 * Shared reaction type definitions
 */

/**
 * Reaction types for posts and comments
 */
export enum ReactionType {
  LIKE = 'like',
  LOVE = 'love',
  LAUGH = 'laugh',
  WOW = 'wow',
  SAD = 'sad',
  ANGRY = 'angry'
}

/**
 * Validate if a string is a valid reaction type
 */
export function isValidReactionType(type: string): type is ReactionType {
  return Object.values(ReactionType).includes(type as ReactionType);
}
