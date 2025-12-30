/**
 * Comment Types and Interfaces
 * M4 Comments Module - TypeScript Type Definitions
 *
 * Follows architecture specification from m4-comments-architecture.md
 */

import { ReactionType } from '../types/reaction.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Who deleted the comment
 */
export enum DeletedBy {
  AUTHOR = 'author',
  POST_OWNER = 'post_owner',
  MODERATOR = 'moderator'
}

/**
 * Comment sort options
 */
export enum CommentSortOrder {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  POPULAR = 'popular'
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Comment author information
 */
export interface CommentAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * Mention in a comment
 */
export interface CommentMention {
  userId: string;
  username: string;
}

/**
 * Base comment entity
 */
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  path: string; // Materialized path for tree structure
  depth: number; // 0, 1, or 2 (max 3 levels)
  likesCount: number;
  repliesCount: number;
  isDeleted: boolean;
  deletedBy: DeletedBy | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Comment with author information
 */
export interface CommentWithAuthor extends Comment {
  author: CommentAuthor;
}

/**
 * Comment with full metadata for API responses
 */
export interface CommentResponse extends CommentWithAuthor {
  mentions: CommentMention[];
  userReaction: ReactionType | null;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Comment tree node with nested replies
 */
export interface CommentTreeNode extends CommentResponse {
  replies: CommentTreeNode[];
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

/**
 * Create comment request
 */
export interface CreateCommentDTO {
  postId: string;
  content: string;
  parentCommentId?: string | null;
}

/**
 * Update comment request
 */
export interface UpdateCommentDTO {
  content: string;
}

/**
 * Get comment tree request params
 */
export interface GetCommentTreeParams {
  postId: string;
  sort?: CommentSortOrder;
  limit?: number;
  offset?: number;
  userId?: string | null; // Current user for reaction lookup
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Pagination info
 */
export interface PaginationInfo {
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Comment tree response
 */
export interface CommentTreeResponse {
  comments: CommentTreeNode[];
  pagination: PaginationInfo;
  totalCount: number;
}

/**
 * Delete comment response
 */
export interface DeleteCommentResponse {
  message: string;
  deletedBy: DeletedBy;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Flat comment from database query with join data
 */
export interface FlatCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  path: string;
  depth: number;
  likes_count: number;
  replies_count: number;
  is_deleted: boolean;
  deleted_by: string | null;
  edited_at: Date | null;
  created_at: Date;
  updated_at: Date;
  author_username: string;
  author_avatar: string | null;
  user_reaction: string | null;
}

/**
 * Comment creation internal data
 */
export interface CommentCreateData {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  path: string;
  depth: number;
}

/**
 * Depth validation result
 */
export interface DepthValidationResult {
  isValid: boolean;
  parentDepth: number;
  newDepth: number;
  maxDepth: number;
  errorMessage?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum nesting depth for comments (0, 1, 2 = 3 levels)
 */
export const MAX_COMMENT_DEPTH = 2;

/**
 * Maximum content length for comments
 */
export const MAX_CONTENT_LENGTH = 5000;

/**
 * Minimum content length for comments
 */
export const MIN_CONTENT_LENGTH = 1;

/**
 * Edit window in minutes
 */
export const EDIT_WINDOW_MINUTES = 5;

/**
 * Maximum mentions per comment
 */
export const MAX_MENTIONS_PER_COMMENT = 10;

/**
 * Default pagination limit
 */
export const DEFAULT_COMMENT_LIMIT = 50;

/**
 * Maximum pagination limit
 */
export const MAX_COMMENT_LIMIT = 100;
