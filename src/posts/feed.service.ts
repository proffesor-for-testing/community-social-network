/**
 * Feed Service
 * Business logic for feed generation with caching
 * Implements TDD GREEN phase requirements
 *
 * Features:
 * - Cursor-based pagination (20 items per page)
 * - 3-tier caching: Memory LRU -> Redis -> PostgreSQL
 * - Feed p95 < 300ms target
 */

import { FeedRepository } from './feed.repository';
import { CacheService, CacheKeyBuilder } from './cache.service';
import { FollowRepository } from '../social/follow.repository';
import { GroupMemberRepository } from '../groups/group-member.repository';
import {
  FeedResult,
  FeedItem,
  POST_CONSTANTS,
} from './types';

export class FeedServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FeedServiceError';
  }
}

export class FeedService {
  constructor(
    private readonly feedRepository: FeedRepository,
    private readonly cacheService: CacheService,
    private readonly followRepository: FollowRepository,
    private readonly groupMemberRepository: GroupMemberRepository
  ) {}

  /**
   * Get home feed for a user
   * Posts from followed users and joined groups
   */
  async getHomeFeed(
    userId: string,
    cursor?: string,
    limit: number = POST_CONSTANTS.DEFAULT_PAGE_SIZE
  ): Promise<FeedResult> {
    // Validate limit
    const safeLimit = Math.min(limit, POST_CONSTANTS.MAX_PAGE_SIZE);

    // Check cache first (only for first page without cursor)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.homeFeed(userId, 1);
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Get user's following list and group memberships
    const [followingIds, groupIds] = await Promise.all([
      this.followRepository.getFollowingIds(userId),
      this.groupMemberRepository.getUserGroupIds(userId),
    ]);

    // Decode cursor if provided
    const cursorDate = cursor
      ? new Date(Buffer.from(cursor, 'base64').toString('utf-8'))
      : undefined;

    // Fetch posts (one extra to check for more)
    const posts = await this.feedRepository.getHomeFeed({
      userId,
      followingIds,
      groupIds,
      cursor: cursorDate,
      limit: safeLimit + 1,
    });

    // Determine if there are more posts
    const hasMore = posts.length > safeLimit;
    const items = hasMore ? posts.slice(0, safeLimit) : posts;

    // Generate next cursor
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? Buffer.from(lastItem.createdAt.toISOString()).toString('base64')
      : undefined;

    const result: FeedResult = { items, nextCursor };

    // Cache the result (only for first page)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.homeFeed(userId, 1);
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(result),
        POST_CONSTANTS.HOME_FEED_CACHE_TTL
      );
    }

    return result;
  }

  /**
   * Get group feed
   * Posts from a specific group
   */
  async getGroupFeed(
    groupId: string,
    userId: string,
    cursor?: string,
    limit: number = POST_CONSTANTS.DEFAULT_PAGE_SIZE
  ): Promise<FeedResult> {
    // Check group membership
    const isMember = await this.groupMemberRepository.isMember(groupId, userId);

    if (!isMember) {
      throw new FeedServiceError(
        'Not a member of this group',
        'NOT_GROUP_MEMBER'
      );
    }

    // Validate limit
    const safeLimit = Math.min(limit, POST_CONSTANTS.MAX_PAGE_SIZE);

    // Check cache first (only for first page without cursor)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.groupFeed(groupId, 1);
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Decode cursor if provided
    const cursorDate = cursor
      ? new Date(Buffer.from(cursor, 'base64').toString('utf-8'))
      : undefined;

    // Fetch posts
    const posts = await this.feedRepository.getGroupFeed({
      groupId,
      cursor: cursorDate,
      limit: safeLimit + 1,
    });

    // Determine if there are more posts
    const hasMore = posts.length > safeLimit;
    const items = hasMore ? posts.slice(0, safeLimit) : posts;

    // Generate next cursor
    const lastItemGroup = items[items.length - 1];
    const nextCursor = hasMore && lastItemGroup
      ? Buffer.from(lastItemGroup.createdAt.toISOString()).toString('base64')
      : undefined;

    const result: FeedResult = { items, nextCursor };

    // Cache the result (only for first page)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.groupFeed(groupId, 1);
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(result),
        POST_CONSTANTS.GROUP_FEED_CACHE_TTL
      );
    }

    return result;
  }

  /**
   * Get user profile feed
   * Posts from a specific user
   */
  async getUserProfileFeed(
    profileUserId: string,
    cursor?: string,
    limit: number = POST_CONSTANTS.DEFAULT_PAGE_SIZE
  ): Promise<FeedResult> {
    // Validate limit
    const safeLimit = Math.min(limit, POST_CONSTANTS.MAX_PAGE_SIZE);

    // Check cache first (only for first page without cursor)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.userProfileFeed(profileUserId, 1);
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Decode cursor if provided
    const cursorDate = cursor
      ? new Date(Buffer.from(cursor, 'base64').toString('utf-8'))
      : undefined;

    // Fetch posts
    const posts = await this.feedRepository.getUserProfileFeed({
      userId: profileUserId,
      cursor: cursorDate,
      limit: safeLimit + 1,
    });

    // Determine if there are more posts
    const hasMore = posts.length > safeLimit;
    const items = hasMore ? posts.slice(0, safeLimit) : posts;

    // Generate next cursor
    const lastItemProfile = items[items.length - 1];
    const nextCursor = hasMore && lastItemProfile
      ? Buffer.from(lastItemProfile.createdAt.toISOString()).toString('base64')
      : undefined;

    const result: FeedResult = { items, nextCursor };

    // Cache the result (only for first page)
    if (!cursor) {
      const cacheKey = CacheKeyBuilder.userProfileFeed(profileUserId, 1);
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(result),
        POST_CONSTANTS.PROFILE_FEED_CACHE_TTL
      );
    }

    return result;
  }

  /**
   * Invalidate home feeds for followers of a user
   * Called when a user creates a new post
   */
  async invalidateHomeFeedsForFollowers(authorId: string): Promise<void> {
    // In a production system, we would get the list of followers
    // and invalidate only their feeds. For simplicity, we invalidate all home feeds.
    await this.cacheService.invalidatePattern('feed:home:*');
  }

  /**
   * Invalidate group feed cache
   */
  async invalidateGroupFeed(groupId: string): Promise<void> {
    await this.cacheService.invalidatePattern(
      CacheKeyBuilder.groupFeedPattern(groupId)
    );
  }

  /**
   * Invalidate user profile feed cache
   */
  async invalidateUserProfileFeed(userId: string): Promise<void> {
    await this.cacheService.invalidatePattern(
      CacheKeyBuilder.userProfileFeedPattern(userId)
    );
  }

  /**
   * Calculate engagement score for a post
   * Used for feed ranking
   */
  calculateEngagementScore(post: FeedItem): number {
    const LIKE_WEIGHT = 1;
    const COMMENT_WEIGHT = 2;
    const SHARE_WEIGHT = 3;

    return (
      (post.likesCount || 0) * LIKE_WEIGHT +
      (post.commentsCount || 0) * COMMENT_WEIGHT +
      (post.sharesCount || 0) * SHARE_WEIGHT
    );
  }
}
