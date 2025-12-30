/**
 * Reaction Service Unit Tests - TDD London School
 * Tests for ReactionService using mock-driven development
 *
 * Following Outside-In TDD approach:
 * - Toggle reactions (add/remove)
 * - One reaction per user per post
 * - Reaction type validation
 */

import { ReactionService } from '../../../src/posts/reaction.service';
import { ReactionRepository } from '../../../src/posts/reaction.repository';
import { PostRepository } from '../../../src/posts/post.repository';
import { CacheService } from '../../../src/posts/cache.service';
import { Post, Reaction, ReactionType, PostVisibility, PostStatus } from '../../../src/posts/types';
import { EventEmitter } from 'events';

describe('ReactionService', () => {
  let reactionService: ReactionService;
  let mockReactionRepository: jest.Mocked<ReactionRepository>;
  let mockPostRepository: jest.Mocked<PostRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventEmitter: jest.Mocked<EventEmitter>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPostId = '987fcdeb-51a2-3bc4-d567-890123456789';

  // Helper to create a valid Post
  const createMockPost = (overrides: Partial<Post> = {}): Post => ({
    id: mockPostId,
    authorId: 'different-user',
    content: 'Test post',
    groupId: null,
    visibility: 'public' as PostVisibility,
    status: 'published' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 10,
    commentsCount: 5,
    isPinned: false,
    isDeleted: false,
    ...overrides,
  });

  // Helper to create a valid Reaction
  const createMockReaction = (overrides: Partial<Reaction> = {}): Reaction => ({
    id: 'reaction-id',
    userId: mockUserId,
    postId: mockPostId,
    type: 'like' as ReactionType,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockReactionRepository = {
      findByUserAndPost: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      getReactionCounts: jest.fn(),
      getUserReaction: jest.fn(),
    } as unknown as jest.Mocked<ReactionRepository>;

    mockPostRepository = {
      findById: jest.fn(),
      incrementLikesCount: jest.fn(),
      decrementLikesCount: jest.fn(),
    } as unknown as jest.Mocked<PostRepository>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidatePattern: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter>;

    reactionService = new ReactionService(
      mockReactionRepository,
      mockPostRepository,
      mockCacheService,
      mockEventEmitter
    );
  });

  describe('toggleReaction', () => {
    const validPost = createMockPost();

    it('should add reaction when user has not reacted', async () => {
      // Arrange
      const reactionType: ReactionType = 'like';
      const newReaction = createMockReaction({ type: reactionType });

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(null);
      mockReactionRepository.upsert.mockResolvedValue(newReaction);

      // Act
      const result = await reactionService.toggleReaction(mockPostId, mockUserId, reactionType);

      // Assert
      expect(mockReactionRepository.findByUserAndPost).toHaveBeenCalledWith(mockUserId, mockPostId);
      expect(mockReactionRepository.upsert).toHaveBeenCalledWith({
        userId: mockUserId,
        postId: mockPostId,
        type: reactionType,
      });
      expect(mockPostRepository.incrementLikesCount).toHaveBeenCalledWith(mockPostId);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('reaction.added', expect.any(Object));
      expect(result).toEqual({
        action: 'added',
        reaction: expect.objectContaining({
          type: reactionType,
        }),
      });
    });

    it('should remove reaction when user clicks same reaction type', async () => {
      // Arrange
      const existingReaction = createMockReaction({ type: 'like' });

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(existingReaction);
      mockReactionRepository.delete.mockResolvedValue(true);

      // Act
      const result = await reactionService.toggleReaction(mockPostId, mockUserId, 'like');

      // Assert
      expect(mockReactionRepository.delete).toHaveBeenCalledWith(existingReaction.id);
      expect(mockPostRepository.decrementLikesCount).toHaveBeenCalledWith(mockPostId);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('reaction.removed', expect.any(Object));
      expect(result).toEqual({
        action: 'removed',
        reaction: null,
      });
    });

    it('should change reaction type when user clicks different reaction', async () => {
      // Arrange
      const existingReaction = createMockReaction({ type: 'like' });
      const newReactionType: ReactionType = 'love';
      const updatedReaction = createMockReaction({ type: newReactionType });

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(existingReaction);
      mockReactionRepository.upsert.mockResolvedValue(updatedReaction);

      // Act
      const result = await reactionService.toggleReaction(mockPostId, mockUserId, newReactionType);

      // Assert
      expect(mockReactionRepository.upsert).toHaveBeenCalledWith({
        userId: mockUserId,
        postId: mockPostId,
        type: newReactionType,
      });
      expect(mockPostRepository.incrementLikesCount).not.toHaveBeenCalled();
      expect(mockPostRepository.decrementLikesCount).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('reaction.changed', expect.any(Object));
      expect(result).toEqual({
        action: 'changed',
        reaction: expect.objectContaining({
          type: newReactionType,
        }),
      });
    });

    it('should throw error when post not found', async () => {
      // Arrange
      mockPostRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        reactionService.toggleReaction(mockPostId, mockUserId, 'like')
      ).rejects.toThrow('Post not found');

      expect(mockReactionRepository.upsert).not.toHaveBeenCalled();
    });

    it('should throw error when post is deleted', async () => {
      // Arrange
      const deletedPost = createMockPost({ isDeleted: true });
      mockPostRepository.findById.mockResolvedValue(deletedPost);

      // Act & Assert
      await expect(
        reactionService.toggleReaction(mockPostId, mockUserId, 'like')
      ).rejects.toThrow('Cannot react to deleted post');
    });

    it('should throw error for invalid reaction type', async () => {
      // Arrange
      mockPostRepository.findById.mockResolvedValue(validPost);

      // Act & Assert
      await expect(
        reactionService.toggleReaction(mockPostId, mockUserId, 'invalid' as ReactionType)
      ).rejects.toThrow('Invalid reaction type');
    });

    it('should invalidate cache after reaction change', async () => {
      // Arrange
      const newReaction = createMockReaction();

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(null);
      mockReactionRepository.upsert.mockResolvedValue(newReaction);

      // Act
      await reactionService.toggleReaction(mockPostId, mockUserId, 'like');

      // Assert
      expect(mockCacheService.delete).toHaveBeenCalledWith(`post:${mockPostId}:reactions`);
    });
  });

  describe('getReactionCounts', () => {
    it('should return reaction counts from cache when available', async () => {
      // Arrange
      const cachedCounts = {
        like: 10,
        love: 5,
        laugh: 2,
        wow: 1,
        sad: 0,
        angry: 0,
        total: 18,
      };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedCounts));

      // Act
      const result = await reactionService.getReactionCounts(mockPostId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(`post:${mockPostId}:reactions`);
      expect(mockReactionRepository.getReactionCounts).not.toHaveBeenCalled();
      expect(result).toEqual(cachedCounts);
    });

    it('should fetch from database and cache on cache miss', async () => {
      // Arrange
      const dbCounts = {
        like: 10,
        love: 5,
        laugh: 2,
        wow: 1,
        sad: 0,
        angry: 0,
        total: 18,
      };
      mockCacheService.get.mockResolvedValue(null);
      mockReactionRepository.getReactionCounts.mockResolvedValue(dbCounts);

      // Act
      const result = await reactionService.getReactionCounts(mockPostId);

      // Assert
      expect(mockReactionRepository.getReactionCounts).toHaveBeenCalledWith(mockPostId);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `post:${mockPostId}:reactions`,
        JSON.stringify(dbCounts),
        120
      );
      expect(result).toEqual(dbCounts);
    });
  });

  describe('getUserReaction', () => {
    it('should return user reaction for a post', async () => {
      // Arrange
      const userReaction = createMockReaction();
      mockReactionRepository.getUserReaction.mockResolvedValue(userReaction);

      // Act
      const result = await reactionService.getUserReaction(mockPostId, mockUserId);

      // Assert
      expect(mockReactionRepository.getUserReaction).toHaveBeenCalledWith(mockUserId, mockPostId);
      expect(result).toEqual(userReaction);
    });

    it('should return null when user has not reacted', async () => {
      // Arrange
      mockReactionRepository.getUserReaction.mockResolvedValue(null);

      // Act
      const result = await reactionService.getUserReaction(mockPostId, mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Reaction Types', () => {
    const validPost = createMockPost();
    const validReactionTypes: ReactionType[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];

    it.each(validReactionTypes)('should accept valid reaction type: %s', async (reactionType) => {
      // Arrange
      const newReaction = createMockReaction({ type: reactionType });

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(null);
      mockReactionRepository.upsert.mockResolvedValue(newReaction);

      // Act
      const result = await reactionService.toggleReaction(mockPostId, mockUserId, reactionType);

      // Assert
      expect(result.action).toBe('added');
      expect(result.reaction?.type).toBe(reactionType);
    });
  });

  describe('Event Emission', () => {
    const validPost = createMockPost({ authorId: 'author-id' });

    it('should emit reaction.added event with correct payload', async () => {
      // Arrange
      const newReaction = createMockReaction();

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(null);
      mockReactionRepository.upsert.mockResolvedValue(newReaction);

      // Act
      await reactionService.toggleReaction(mockPostId, mockUserId, 'like');

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reaction.added',
        expect.objectContaining({
          postId: mockPostId,
          userId: mockUserId,
          authorId: validPost.authorId,
          reactionType: 'like',
        })
      );
    });

    it('should emit reaction.removed event with correct payload', async () => {
      // Arrange
      const existingReaction = createMockReaction();

      mockPostRepository.findById.mockResolvedValue(validPost);
      mockReactionRepository.findByUserAndPost.mockResolvedValue(existingReaction);
      mockReactionRepository.delete.mockResolvedValue(true);

      // Act
      await reactionService.toggleReaction(mockPostId, mockUserId, 'like');

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reaction.removed',
        expect.objectContaining({
          postId: mockPostId,
          userId: mockUserId,
          reactionType: 'like',
        })
      );
    });
  });
});
