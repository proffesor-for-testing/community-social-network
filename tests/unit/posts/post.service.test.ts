/**
 * Post Service Unit Tests - TDD London School
 * Tests for PostService using mock-driven development
 *
 * Following Outside-In TDD approach:
 * - Define behavior through mock expectations
 * - Verify object collaborations
 * - Focus on interactions, not state
 */

import { PostService } from '../../../src/posts/post.service';
import { PostRepository } from '../../../src/posts/post.repository';
import { SanitizerService } from '../../../src/posts/sanitizer';
import { CacheService } from '../../../src/posts/cache.service';
import { Post, PostVisibility, PostStatus } from '../../../src/posts/types';
import { EventEmitter } from 'events';

describe('PostService', () => {
  let postService: PostService;
  let mockPostRepository: jest.Mocked<PostRepository>;
  let mockSanitizerService: jest.Mocked<SanitizerService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventEmitter: jest.Mocked<EventEmitter>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPostId = '987fcdeb-51a2-3bc4-d567-890123456789';
  const mockGroupId = 'aabbccdd-1122-3344-5566-778899001122';

  // Helper to create a valid Post object
  const createMockPost = (overrides: Partial<Post> = {}): Post => ({
    id: mockPostId,
    authorId: mockUserId,
    content: 'Test content',
    groupId: null,
    visibility: 'public' as PostVisibility,
    status: 'published' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    commentsCount: 0,
    isPinned: false,
    isDeleted: false,
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockPostRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByAuthor: jest.fn(),
      findByGroup: jest.fn(),
      incrementLikesCount: jest.fn(),
      decrementLikesCount: jest.fn(),
    } as unknown as jest.Mocked<PostRepository>;

    mockSanitizerService = {
      sanitize: jest.fn(),
      stripAllHtml: jest.fn(),
      validateContentLength: jest.fn(),
    } as unknown as jest.Mocked<SanitizerService>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidatePattern: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter>;

    // Create service with mocked dependencies
    postService = new PostService(
      mockPostRepository,
      mockSanitizerService,
      mockCacheService,
      mockEventEmitter
    );
  });

  describe('createPost', () => {
    const validPostData = {
      authorId: mockUserId,
      content: 'Hello, this is my first post!',
      groupId: undefined,
      visibility: 'public' as PostVisibility,
    };

    it('should create post successfully with valid content', async () => {
      // Arrange
      const sanitizedContent = 'Hello, this is my first post!';
      const expectedPost = createMockPost({
        content: sanitizedContent,
      });

      mockSanitizerService.sanitize.mockReturnValue(sanitizedContent);
      mockPostRepository.create.mockResolvedValue(expectedPost);

      // Act
      const result = await postService.createPost(validPostData);

      // Assert - Verify interactions
      expect(mockSanitizerService.sanitize).toHaveBeenCalledWith(validPostData.content);
      expect(mockPostRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: validPostData.authorId,
          content: sanitizedContent,
          visibility: 'public',
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('post.created', expect.any(Object));
      expect(mockCacheService.invalidatePattern).toHaveBeenCalled();
      expect(result).toEqual(expectedPost);
    });

    it('should sanitize XSS content before saving', async () => {
      // Arrange
      const maliciousContent = '<script>alert("xss")</script>Hello world!';
      const sanitizedContent = 'Hello world!';
      const postData = { ...validPostData, content: maliciousContent };

      mockSanitizerService.sanitize.mockReturnValue(sanitizedContent);
      mockPostRepository.create.mockResolvedValue(
        createMockPost({ content: sanitizedContent })
      );

      // Act
      await postService.createPost(postData);

      // Assert - Verify sanitizer was called with malicious content
      expect(mockSanitizerService.sanitize).toHaveBeenCalledWith(maliciousContent);
      expect(mockPostRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: sanitizedContent,
        })
      );
    });

    it('should throw error when content is empty', async () => {
      // Arrange
      const postData = { ...validPostData, content: '' };
      mockSanitizerService.sanitize.mockReturnValue('');

      // Act & Assert
      await expect(postService.createPost(postData)).rejects.toThrow('Post content cannot be empty');
      expect(mockPostRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when content exceeds maximum length', async () => {
      // Arrange
      const longContent = 'a'.repeat(10001);
      const postData = { ...validPostData, content: longContent };
      mockSanitizerService.sanitize.mockReturnValue(longContent);

      // Act & Assert
      await expect(postService.createPost(postData)).rejects.toThrow('Post content exceeds maximum length');
      expect(mockPostRepository.create).not.toHaveBeenCalled();
    });

    it('should create post with group association', async () => {
      // Arrange
      const postData = { ...validPostData, groupId: mockGroupId };
      const expectedPost = createMockPost({
        groupId: mockGroupId,
        visibility: 'group' as PostVisibility,
      });

      mockSanitizerService.sanitize.mockReturnValue(validPostData.content);
      mockPostRepository.create.mockResolvedValue(expectedPost);

      // Act
      const result = await postService.createPost(postData);

      // Assert
      expect(mockPostRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: mockGroupId,
        })
      );
      expect(result.groupId).toBe(mockGroupId);
    });
  });

  describe('editPost', () => {
    it('should allow edit within 5 minutes of creation', async () => {
      // Arrange - compute dates fresh at test execution time
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000); // Well within edit window

      const existingPost = createMockPost({
        content: 'Original content',
        createdAt: twoMinutesAgo,
        updatedAt: twoMinutesAgo,
      });

      const updatedContent = 'Updated content';
      const updatedPost = createMockPost({
        content: updatedContent,
        createdAt: twoMinutesAgo,
        updatedAt: now,
      });

      mockPostRepository.findById.mockResolvedValue(existingPost);
      mockSanitizerService.sanitize.mockReturnValue(updatedContent);
      mockPostRepository.update.mockResolvedValue(updatedPost);

      // Act
      const result = await postService.editPost(mockPostId, mockUserId, updatedContent);

      // Assert
      expect(mockPostRepository.findById).toHaveBeenCalledWith(mockPostId);
      expect(mockSanitizerService.sanitize).toHaveBeenCalledWith(updatedContent);
      expect(mockPostRepository.update).toHaveBeenCalledWith(
        mockPostId,
        expect.objectContaining({ content: updatedContent })
      );
      expect(result.content).toBe(updatedContent);
    });

    it('should reject edit after 5 minutes', async () => {
      // Arrange - compute dates fresh at test execution time
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000); // Outside edit window

      const existingPost = createMockPost({
        content: 'Original content',
        createdAt: sixMinutesAgo,
        updatedAt: sixMinutesAgo,
      });

      mockPostRepository.findById.mockResolvedValue(existingPost);

      // Act & Assert
      await expect(
        postService.editPost(mockPostId, mockUserId, 'Updated content')
      ).rejects.toThrow('Post can only be edited within 5 minutes of creation');

      expect(mockPostRepository.update).not.toHaveBeenCalled();
    });

    it('should reject edit by non-author', async () => {
      // Arrange
      const differentUserId = 'different-user-id';
      const existingPost = createMockPost();

      mockPostRepository.findById.mockResolvedValue(existingPost);

      // Act & Assert
      await expect(
        postService.editPost(mockPostId, differentUserId, 'Updated content')
      ).rejects.toThrow('You can only edit your own posts');

      expect(mockPostRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when post not found', async () => {
      // Arrange
      mockPostRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        postService.editPost(mockPostId, mockUserId, 'Updated content')
      ).rejects.toThrow('Post not found');
    });
  });

  describe('deletePost', () => {
    it('should soft delete post successfully', async () => {
      // Arrange
      const existingPost = createMockPost({
        content: 'Content to delete',
      });

      const deletedPost = createMockPost({
        ...existingPost,
        isDeleted: true,
        updatedAt: new Date(),
      });

      mockPostRepository.findById.mockResolvedValue(existingPost);
      mockPostRepository.softDelete.mockResolvedValue(deletedPost);

      // Act
      const result = await postService.deletePost(mockPostId, mockUserId);

      // Assert
      expect(mockPostRepository.findById).toHaveBeenCalledWith(mockPostId);
      expect(mockPostRepository.softDelete).toHaveBeenCalledWith(mockPostId);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('post.deleted', expect.any(Object));
      expect(mockCacheService.invalidatePattern).toHaveBeenCalled();
      expect(result.isDeleted).toBe(true);
    });

    it('should reject delete by non-author', async () => {
      // Arrange
      const differentUserId = 'different-user-id';
      const existingPost = createMockPost();

      mockPostRepository.findById.mockResolvedValue(existingPost);

      // Act & Assert
      await expect(
        postService.deletePost(mockPostId, differentUserId)
      ).rejects.toThrow('You can only delete your own posts');

      expect(mockPostRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should throw error when post not found', async () => {
      // Arrange
      mockPostRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        postService.deletePost(mockPostId, mockUserId)
      ).rejects.toThrow('Post not found');
    });

    it('should throw error when post already deleted', async () => {
      // Arrange
      const deletedPost = createMockPost({ isDeleted: true });

      mockPostRepository.findById.mockResolvedValue(deletedPost);

      // Act & Assert
      await expect(
        postService.deletePost(mockPostId, mockUserId)
      ).rejects.toThrow('Post is already deleted');
    });
  });

  describe('getPost', () => {
    it('should return post from cache if available', async () => {
      // Arrange
      const cachedPost = createMockPost({
        content: 'Cached content',
        likesCount: 10,
        commentsCount: 5,
      });

      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedPost));

      // Act
      const result = await postService.getPost(mockPostId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(`post:${mockPostId}:v1`);
      expect(mockPostRepository.findById).not.toHaveBeenCalled();
      expect(result.content).toBe('Cached content');
    });

    it('should fetch from database on cache miss and update cache', async () => {
      // Arrange
      const dbPost = createMockPost({
        content: 'Database content',
        likesCount: 10,
        commentsCount: 5,
      });

      mockCacheService.get.mockResolvedValue(null);
      mockPostRepository.findById.mockResolvedValue(dbPost);

      // Act
      const result = await postService.getPost(mockPostId);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(`post:${mockPostId}:v1`);
      expect(mockPostRepository.findById).toHaveBeenCalledWith(mockPostId);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `post:${mockPostId}:v1`,
        JSON.stringify(dbPost),
        900 // 15 minute TTL
      );
      expect(result).toEqual(dbPost);
    });

    it('should throw error when post not found', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockPostRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(postService.getPost(mockPostId)).rejects.toThrow('Post not found');
    });

    it('should throw error when post is deleted', async () => {
      // Arrange
      const deletedPost = createMockPost({ isDeleted: true });

      mockCacheService.get.mockResolvedValue(null);
      mockPostRepository.findById.mockResolvedValue(deletedPost);

      // Act & Assert
      await expect(postService.getPost(mockPostId)).rejects.toThrow('Post not found');
    });
  });
});
