/**
 * Feed Service Unit Tests - TDD London School
 * Tests for FeedService using mock-driven development
 *
 * Following Outside-In TDD approach:
 * - Cursor-based pagination
 * - 3-tier caching (Memory LRU -> Redis -> PostgreSQL)
 * - Feed p95 < 300ms target
 */

import { FeedService } from '../../../src/posts/feed.service';
import { FeedRepository } from '../../../src/posts/feed.repository';
import { CacheService } from '../../../src/posts/cache.service';
import { FollowRepository } from '../../../src/social/follow.repository';
import { GroupMemberRepository } from '../../../src/groups/group-member.repository';
import { FeedItem, PostVisibility, PostStatus } from '../../../src/posts/types';

describe('FeedService', () => {
  let feedService: FeedService;
  let mockFeedRepository: jest.Mocked<FeedRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockFollowRepository: jest.Mocked<FollowRepository>;
  let mockGroupMemberRepository: jest.Mocked<GroupMemberRepository>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockGroupId = 'aabbccdd-1122-3344-5566-778899001122';

  // Helper to create a valid FeedItem
  const createMockFeedItem = (index: number, overrides: Partial<FeedItem> = {}): FeedItem => ({
    id: `post-${index}`,
    authorId: `author-${index % 5}`,
    content: `Post content ${index}`,
    groupId: index % 3 === 0 ? mockGroupId : null,
    visibility: (index % 3 === 0 ? 'group' : 'public') as PostVisibility,
    status: 'published' as PostStatus,
    createdAt: new Date(Date.now() - index * 60000),
    updatedAt: new Date(Date.now() - index * 60000),
    likesCount: Math.floor(Math.random() * 100),
    commentsCount: Math.floor(Math.random() * 50),
    isPinned: index === 0,
    isDeleted: false,
    author: {
      id: `author-${index % 5}`,
      username: `user${index % 5}`,
      profilePictureUrl: null,
    },
    group: index % 3 === 0 ? { id: mockGroupId, name: 'Test Group' } : null,
    engagementScore: 0,
    ...overrides,
  });

  // Sample posts for testing
  const mockPosts: FeedItem[] = Array.from({ length: 25 }, (_, i) => createMockFeedItem(i));

  beforeEach(() => {
    jest.clearAllMocks();

    mockFeedRepository = {
      getHomeFeed: jest.fn(),
      getGroupFeed: jest.fn(),
      getUserProfileFeed: jest.fn(),
    } as unknown as jest.Mocked<FeedRepository>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidatePattern: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    mockFollowRepository = {
      getFollowingIds: jest.fn(),
    } as unknown as jest.Mocked<FollowRepository>;

    mockGroupMemberRepository = {
      getUserGroupIds: jest.fn(),
      isMember: jest.fn(),
    } as unknown as jest.Mocked<GroupMemberRepository>;

    feedService = new FeedService(
      mockFeedRepository,
      mockCacheService,
      mockFollowRepository,
      mockGroupMemberRepository
    );
  });

  describe('getHomeFeed', () => {
    it('should return paginated posts with default limit of 20', async () => {
      // Arrange
      const first21Posts = mockPosts.slice(0, 21);
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue(['author-0', 'author-1', 'author-2']);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([mockGroupId]);
      mockFeedRepository.getHomeFeed.mockResolvedValue(first21Posts);

      // Act
      const result = await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBeDefined();
      expect(mockFeedRepository.getHomeFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          followingIds: ['author-0', 'author-1', 'author-2'],
          groupIds: [mockGroupId],
          limit: 21,
        })
      );
    });

    it('should return posts from cache when available', async () => {
      // Arrange
      const cachedFeed = {
        items: mockPosts.slice(0, 20),
        nextCursor: 'encoded-cursor',
      };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedFeed));

      // Act
      const result = await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `feed:home:user:${mockUserId}:page:1:v1`
      );
      expect(mockFeedRepository.getHomeFeed).not.toHaveBeenCalled();
      expect(result).toEqual(cachedFeed);
    });

    it('should use cursor for pagination', async () => {
      // Arrange
      const cursor = Buffer.from(new Date().toISOString()).toString('base64');
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue(['author-0']);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([]);
      mockFeedRepository.getHomeFeed.mockResolvedValue(mockPosts.slice(10, 31));

      // Act
      const result = await feedService.getHomeFeed(mockUserId, cursor, 20);

      // Assert
      expect(mockFeedRepository.getHomeFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: expect.any(Date),
        })
      );
      expect(result.items.length).toBeLessThanOrEqual(20);
    });

    it('should return empty array when user follows no one and has no groups', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue([]);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([]);
      mockFeedRepository.getHomeFeed.mockResolvedValue([]);

      // Act
      const result = await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should have no nextCursor when fewer items than limit', async () => {
      // Arrange
      const fewPosts = mockPosts.slice(0, 10);
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue(['author-0']);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([]);
      mockFeedRepository.getHomeFeed.mockResolvedValue(fewPosts);

      // Act
      const result = await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should cache feed result with 5 minute TTL', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue(['author-0']);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([]);
      mockFeedRepository.getHomeFeed.mockResolvedValue(mockPosts.slice(0, 21));

      // Act
      await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(`feed:home:user:${mockUserId}`),
        expect.any(String),
        300
      );
    });

    it('should prioritize pinned posts', async () => {
      // Arrange
      const pinnedPost = createMockFeedItem(5, { isPinned: true });
      const postsWithPinned = [pinnedPost, ...mockPosts.slice(0, 5)];
      mockCacheService.get.mockResolvedValue(null);
      mockFollowRepository.getFollowingIds.mockResolvedValue(['author-0']);
      mockGroupMemberRepository.getUserGroupIds.mockResolvedValue([]);
      mockFeedRepository.getHomeFeed.mockResolvedValue(postsWithPinned);

      // Act
      const result = await feedService.getHomeFeed(mockUserId);

      // Assert
      expect(result.items[0]?.isPinned).toBe(true);
    });
  });

  describe('getGroupFeed', () => {
    it('should return group feed when user is member', async () => {
      // Arrange
      const groupPosts = mockPosts.filter((p) => p.groupId === mockGroupId);
      mockCacheService.get.mockResolvedValue(null);
      mockGroupMemberRepository.isMember.mockResolvedValue(true);
      mockFeedRepository.getGroupFeed.mockResolvedValue(groupPosts);

      // Act
      const result = await feedService.getGroupFeed(mockGroupId, mockUserId);

      // Assert
      expect(mockGroupMemberRepository.isMember).toHaveBeenCalledWith(mockGroupId, mockUserId);
      expect(result.items.every((p) => p.groupId === mockGroupId)).toBe(true);
    });

    it('should throw error when user is not a member', async () => {
      // Arrange
      mockGroupMemberRepository.isMember.mockResolvedValue(false);

      // Act & Assert
      await expect(
        feedService.getGroupFeed(mockGroupId, mockUserId)
      ).rejects.toThrow('Not a member of this group');

      expect(mockFeedRepository.getGroupFeed).not.toHaveBeenCalled();
    });

    it('should return cached group feed when available', async () => {
      // Arrange
      const cachedFeed = {
        items: mockPosts.slice(0, 10),
        nextCursor: undefined,
      };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedFeed));
      mockGroupMemberRepository.isMember.mockResolvedValue(true);

      // Act
      const result = await feedService.getGroupFeed(mockGroupId, mockUserId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `feed:group:${mockGroupId}:page:1:v1`
      );
      expect(mockFeedRepository.getGroupFeed).not.toHaveBeenCalled();
    });

    it('should support cursor-based pagination for group feed', async () => {
      // Arrange
      const cursor = Buffer.from(new Date().toISOString()).toString('base64');
      mockCacheService.get.mockResolvedValue(null);
      mockGroupMemberRepository.isMember.mockResolvedValue(true);
      mockFeedRepository.getGroupFeed.mockResolvedValue(mockPosts.slice(5, 15));

      // Act
      await feedService.getGroupFeed(mockGroupId, mockUserId, cursor, 10);

      // Assert
      expect(mockFeedRepository.getGroupFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: mockGroupId,
          cursor: expect.any(Date),
          limit: 11,
        })
      );
    });

    it('should cache group feed with 3 minute TTL', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockGroupMemberRepository.isMember.mockResolvedValue(true);
      mockFeedRepository.getGroupFeed.mockResolvedValue([]);

      // Act
      await feedService.getGroupFeed(mockGroupId, mockUserId);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(`feed:group:${mockGroupId}`),
        expect.any(String),
        180
      );
    });
  });

  describe('getUserProfileFeed', () => {
    const profileUserId = 'profile-user-id';

    it('should return posts from a specific user', async () => {
      // Arrange
      const userPosts = mockPosts.filter((p) => p.authorId === 'author-0');
      mockCacheService.get.mockResolvedValue(null);
      mockFeedRepository.getUserProfileFeed.mockResolvedValue(userPosts);

      // Act
      const result = await feedService.getUserProfileFeed(profileUserId);

      // Assert
      expect(mockFeedRepository.getUserProfileFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: profileUserId,
          limit: 21,
        })
      );
      expect(result.items).toHaveLength(userPosts.length);
    });

    it('should return cached profile feed when available', async () => {
      // Arrange
      const cachedFeed = {
        items: mockPosts.slice(0, 5),
        nextCursor: undefined,
      };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedFeed));

      // Act
      const result = await feedService.getUserProfileFeed(profileUserId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `feed:profile:user:${profileUserId}:page:1:v1`
      );
      expect(mockFeedRepository.getUserProfileFeed).not.toHaveBeenCalled();
    });

    it('should cache profile feed with 10 minute TTL', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockFeedRepository.getUserProfileFeed.mockResolvedValue([]);

      // Act
      await feedService.getUserProfileFeed(profileUserId);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(`feed:profile:user:${profileUserId}`),
        expect.any(String),
        600
      );
    });

    it('should support cursor-based pagination for profile feed', async () => {
      // Arrange
      const cursor = Buffer.from(new Date().toISOString()).toString('base64');
      mockCacheService.get.mockResolvedValue(null);
      mockFeedRepository.getUserProfileFeed.mockResolvedValue(mockPosts.slice(0, 10));

      // Act
      await feedService.getUserProfileFeed(profileUserId, cursor, 10);

      // Assert
      expect(mockFeedRepository.getUserProfileFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: expect.any(Date),
        })
      );
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate user home feeds when post is created', async () => {
      // Arrange
      const authorId = 'author-id';

      // Act
      await feedService.invalidateHomeFeedsForFollowers(authorId);

      // Assert
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(
        `feed:home:*`
      );
    });

    it('should invalidate group feed when post is created in group', async () => {
      // Act
      await feedService.invalidateGroupFeed(mockGroupId);

      // Assert
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(
        `feed:group:${mockGroupId}:*`
      );
    });

    it('should invalidate profile feed when user creates/edits/deletes post', async () => {
      // Arrange
      const userId = 'user-id';

      // Act
      await feedService.invalidateUserProfileFeed(userId);

      // Assert
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(
        `feed:profile:user:${userId}:*`
      );
    });
  });

  describe('Engagement Scoring', () => {
    it('should calculate engagement score correctly', () => {
      // Arrange
      const post = createMockFeedItem(0, {
        likesCount: 10,
        commentsCount: 5,
        sharesCount: 2,
      });

      // Act
      const score = feedService.calculateEngagementScore(post);

      // Assert
      // Score = likes*1 + comments*2 + shares*3 = 10 + 10 + 6 = 26
      expect(score).toBe(26);
    });
  });
});
