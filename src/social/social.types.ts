/**
 * Social Graph Types and Interfaces
 * M6 Social Graph & Follow System
 *
 * These types define the contracts for follow/block operations
 * following the London School TDD approach with mock-driven development.
 */

// ============================================================
// ENUMS
// ============================================================

export enum FollowStatus {
  ACTIVE = 'active',
  PENDING = 'pending'
}

export enum RelationshipStatus {
  NONE = 'none',
  FOLLOWING = 'following',
  PENDING = 'pending',
  BLOCKED = 'blocked'
}

// ============================================================
// ENTITY INTERFACES
// ============================================================

export interface User {
  id: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  followApprovalRequired: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

export interface FollowSuggestion {
  id: string;
  userId: string;
  suggestedUserId: string;
  mutualConnections: number;
  score: number;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================
// SERVICE INTERFACES
// ============================================================

export interface FollowResult {
  success: boolean;
  status: 'followed' | 'pending' | 'already_following';
  follow?: Follow;
  message?: string;
}

export interface UnfollowResult {
  success: boolean;
  message?: string;
}

export interface ApproveRejectResult {
  success: boolean;
  follow?: Follow;
  message?: string;
}

export interface BlockResult {
  success: boolean;
  block?: Block;
  message?: string;
}

export interface UnblockResult {
  success: boolean;
  message?: string;
}

export interface Relationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked: boolean;
  followStatus: RelationshipStatus;
}

export interface PaginatedFollowers {
  data: FollowerInfo[];
  pagination: Pagination;
}

export interface PaginatedFollowing {
  data: FollowingInfo[];
  pagination: Pagination;
}

export interface FollowerInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  followedAt: Date;
}

export interface FollowingInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  followedAt: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// ============================================================
// REPOSITORY INTERFACES (for mocking)
// ============================================================

export interface IFollowRepository {
  create(data: CreateFollowData): Promise<Follow>;
  findByPair(followerId: string, followingId: string): Promise<Follow | null>;
  updateStatus(id: string, status: FollowStatus): Promise<Follow>;
  delete(id: string): Promise<void>;
  deleteByPair(followerId: string, followingId: string): Promise<void>;
  findFollowers(userId: string, options: PaginationOptions): Promise<{ data: Follow[]; total: number }>;
  findFollowing(userId: string, options: PaginationOptions): Promise<{ data: Follow[]; total: number }>;
  findPendingRequests(userId: string, options: PaginationOptions): Promise<{ data: Follow[]; total: number }>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
}

export interface IBlockRepository {
  create(data: CreateBlockData): Promise<Block>;
  findByPair(blockerId: string, blockedId: string): Promise<Block | null>;
  delete(id: string): Promise<void>;
  deleteByPair(blockerId: string, blockedId: string): Promise<void>;
  findBlocks(userId: string, options: PaginationOptions): Promise<{ data: Block[]; total: number }>;
  isBlocked(userId1: string, userId2: string): Promise<boolean>;
  isBidirectionallyBlocked(userId1: string, userId2: string): Promise<boolean>;
}

export interface IUserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  exists(userId: string): Promise<boolean>;
  incrementFollowerCount(userId: string): Promise<void>;
  decrementFollowerCount(userId: string): Promise<void>;
  incrementFollowingCount(userId: string): Promise<void>;
  decrementFollowingCount(userId: string): Promise<void>;
}

// ============================================================
// DATA TRANSFER OBJECTS
// ============================================================

export interface CreateFollowData {
  followerId: string;
  followingId: string;
  status: FollowStatus;
}

export interface CreateBlockData {
  blockerId: string;
  blockedId: string;
  reason?: string;
}

// ============================================================
// SERVICE INTERFACES
// ============================================================

export interface IFollowService {
  follow(followerId: string, followingId: string): Promise<FollowResult>;
  unfollow(followerId: string, followingId: string): Promise<UnfollowResult>;
  approveFollowRequest(ownerId: string, requesterId: string): Promise<ApproveRejectResult>;
  rejectFollowRequest(ownerId: string, requesterId: string): Promise<ApproveRejectResult>;
  getFollowers(userId: string, options?: PaginationOptions): Promise<PaginatedFollowers>;
  getFollowing(userId: string, options?: PaginationOptions): Promise<PaginatedFollowing>;
  getRelationship(userId: string, targetId: string): Promise<Relationship>;
  getPendingRequests(userId: string, options?: PaginationOptions): Promise<{ data: Follow[]; pagination: Pagination }>;
}

export interface IBlockService {
  block(blockerId: string, blockedId: string, reason?: string): Promise<BlockResult>;
  unblock(blockerId: string, blockedId: string): Promise<UnblockResult>;
  isBlocked(userId1: string, userId2: string): Promise<boolean>;
  getBlocks(userId: string, options?: PaginationOptions): Promise<{ data: Block[]; pagination: Pagination }>;
}

export interface IPrivacyService {
  canViewProfile(viewerId: string, targetId: string): Promise<boolean>;
  canViewPosts(viewerId: string, targetId: string): Promise<boolean>;
  canFollow(followerId: string, targetId: string): Promise<boolean>;
  requiresFollowApproval(userId: string): Promise<boolean>;
}

// ============================================================
// EVENT INTERFACES
// ============================================================

export interface FollowEvent {
  type: 'follow.created' | 'follow.approved' | 'follow.removed' | 'follow.requested';
  followerId: string;
  followingId: string;
  status: FollowStatus;
  timestamp: Date;
}

export interface BlockEvent {
  type: 'block.created' | 'block.removed';
  blockerId: string;
  blockedId: string;
  timestamp: Date;
}

export interface IEventPublisher {
  publish(event: FollowEvent | BlockEvent): Promise<void>;
}

// ============================================================
// ERROR TYPES
// ============================================================

export class SocialError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SocialError';
  }
}

export class SelfFollowError extends SocialError {
  constructor() {
    super('Cannot follow yourself', 'SELF_FOLLOW', 400);
  }
}

export class UserBlockedError extends SocialError {
  constructor() {
    super('Cannot follow this user', 'USER_BLOCKED', 403);
  }
}

export class UserNotFoundError extends SocialError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', 404);
  }
}

export class AlreadyFollowingError extends SocialError {
  constructor() {
    super('Already following this user', 'ALREADY_FOLLOWING', 400);
  }
}

export class NotFollowingError extends SocialError {
  constructor() {
    super('Not following this user', 'NOT_FOLLOWING', 404);
  }
}

export class FollowRequestNotFoundError extends SocialError {
  constructor() {
    super('Follow request not found', 'FOLLOW_REQUEST_NOT_FOUND', 404);
  }
}

export class SelfBlockError extends SocialError {
  constructor() {
    super('Cannot block yourself', 'SELF_BLOCK', 400);
  }
}

export class AlreadyBlockedError extends SocialError {
  constructor() {
    super('User is already blocked', 'ALREADY_BLOCKED', 400);
  }
}

export class NotBlockedError extends SocialError {
  constructor() {
    super('User is not blocked', 'NOT_BLOCKED', 404);
  }
}
