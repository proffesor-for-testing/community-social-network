/**
 * Post Types and Interfaces
 * Defines the data structures for posts, feeds, and reactions
 */

export type PostVisibility = 'public' | 'group' | 'private';
export type PostStatus = 'published' | 'draft' | 'scheduled';
export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export interface Post {
  id: string;
  authorId: string;
  content: string;
  groupId: string | null;
  visibility: PostVisibility;
  status: PostStatus;
  scheduledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  isPinned: boolean;
  isDeleted: boolean;
  mediaUrls?: string[];
}

export interface PostWithAuthor extends Post {
  author: {
    id: string;
    username: string;
    profilePictureUrl: string | null;
  };
  group?: {
    id: string;
    name: string;
  } | null;
  engagementScore?: number;
}

export interface CreatePostInput {
  authorId: string;
  content: string;
  groupId?: string;
  visibility?: PostVisibility;
  mediaUrls?: string[];
  scheduledAt?: Date;
}

export interface UpdatePostInput {
  content?: string;
  visibility?: PostVisibility;
  mediaUrls?: string[];
}

export interface Reaction {
  id: string;
  userId: string;
  postId: string;
  type: ReactionType;
  createdAt: Date;
}

export interface ReactionCounts {
  like: number;
  love: number;
  laugh: number;
  wow: number;
  sad: number;
  angry: number;
  total: number;
}

export interface ToggleReactionResult {
  action: 'added' | 'removed' | 'changed';
  reaction: Reaction | null;
}

export interface FeedItem extends PostWithAuthor {}

export interface FeedResult {
  items: FeedItem[];
  nextCursor?: string;
}

export interface FeedQuery {
  userId?: string;
  followingIds?: string[];
  groupIds?: string[];
  groupId?: string;
  cursor?: Date;
  limit: number;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

// Validation constants
export const POST_CONSTANTS = {
  MAX_CONTENT_LENGTH: 10000,
  MIN_CONTENT_LENGTH: 1,
  EDIT_WINDOW_MINUTES: 5,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  HOME_FEED_CACHE_TTL: 300, // 5 minutes
  GROUP_FEED_CACHE_TTL: 180, // 3 minutes
  PROFILE_FEED_CACHE_TTL: 600, // 10 minutes
  POST_CACHE_TTL: 900, // 15 minutes
  REACTION_CACHE_TTL: 120, // 2 minutes
} as const;

export const VALID_REACTION_TYPES: ReactionType[] = [
  'like',
  'love',
  'laugh',
  'wow',
  'sad',
  'angry',
];

export function isValidReactionType(type: string): type is ReactionType {
  return VALID_REACTION_TYPES.includes(type as ReactionType);
}
