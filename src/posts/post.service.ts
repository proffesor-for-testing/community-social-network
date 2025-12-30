/**
 * Post Service
 * Business logic for post CRUD operations
 * Implements TDD GREEN phase requirements
 */

import { EventEmitter } from 'events';
import { PostRepository } from './post.repository';
import { SanitizerService } from './sanitizer';
import { CacheService, CacheKeyBuilder } from './cache.service';
import {
  Post,
  CreatePostInput,
  POST_CONSTANTS,
} from './types';

export class PostServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PostServiceError';
  }
}

export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly sanitizerService: SanitizerService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter
  ) {}

  /**
   * Create a new post
   * - Sanitizes content for XSS prevention
   * - Validates content length
   * - Emits post.created event
   * - Invalidates relevant caches
   */
  async createPost(input: CreatePostInput): Promise<Post> {
    // Sanitize content
    const sanitizedContent = this.sanitizerService.sanitize(input.content);

    // Validate content
    if (!sanitizedContent.trim()) {
      throw new PostServiceError(
        'Post content cannot be empty',
        'EMPTY_CONTENT'
      );
    }

    if (sanitizedContent.length > POST_CONSTANTS.MAX_CONTENT_LENGTH) {
      throw new PostServiceError(
        'Post content exceeds maximum length',
        'CONTENT_TOO_LONG'
      );
    }

    // Determine visibility based on group association
    const visibility = input.groupId ? 'group' : (input.visibility || 'public');

    // Create post
    const post = await this.postRepository.create({
      ...input,
      content: sanitizedContent,
      visibility,
    });

    // Emit event
    this.eventEmitter.emit('post.created', {
      postId: post.id,
      authorId: post.authorId,
      groupId: post.groupId,
      createdAt: post.createdAt,
    });

    // Invalidate caches
    await this.invalidateFeedCaches(post.authorId, post.groupId);

    return post;
  }

  /**
   * Edit a post
   * - Only allowed within 5 minutes of creation
   * - Only the author can edit
   * - Sanitizes new content
   */
  async editPost(
    postId: string,
    userId: string,
    newContent: string
  ): Promise<Post> {
    // Fetch existing post
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new PostServiceError('Post not found', 'POST_NOT_FOUND');
    }

    // Check ownership
    if (post.authorId !== userId) {
      throw new PostServiceError(
        'You can only edit your own posts',
        'UNAUTHORIZED'
      );
    }

    // Check edit window (5 minutes)
    const now = new Date();
    const editWindowMs = POST_CONSTANTS.EDIT_WINDOW_MINUTES * 60 * 1000;
    const timeSinceCreation = now.getTime() - new Date(post.createdAt).getTime();

    if (timeSinceCreation > editWindowMs) {
      throw new PostServiceError(
        'Post can only be edited within 5 minutes of creation',
        'EDIT_WINDOW_EXPIRED'
      );
    }

    // Sanitize new content
    const sanitizedContent = this.sanitizerService.sanitize(newContent);

    if (!sanitizedContent.trim()) {
      throw new PostServiceError(
        'Post content cannot be empty',
        'EMPTY_CONTENT'
      );
    }

    if (sanitizedContent.length > POST_CONSTANTS.MAX_CONTENT_LENGTH) {
      throw new PostServiceError(
        'Post content exceeds maximum length',
        'CONTENT_TOO_LONG'
      );
    }

    // Update post
    const updatedPost = await this.postRepository.update(postId, {
      content: sanitizedContent,
    });

    // Emit event
    this.eventEmitter.emit('post.updated', {
      postId: updatedPost.id,
      authorId: updatedPost.authorId,
      updatedAt: updatedPost.updatedAt,
    });

    // Invalidate caches
    await this.cacheService.delete(CacheKeyBuilder.post(postId));
    await this.invalidateFeedCaches(updatedPost.authorId, updatedPost.groupId);

    return updatedPost;
  }

  /**
   * Delete a post (soft delete)
   * - Only the author can delete
   * - Post is marked as deleted, not removed
   */
  async deletePost(postId: string, userId: string): Promise<Post> {
    // Fetch existing post
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new PostServiceError('Post not found', 'POST_NOT_FOUND');
    }

    // Check if already deleted
    if (post.isDeleted) {
      throw new PostServiceError(
        'Post is already deleted',
        'ALREADY_DELETED'
      );
    }

    // Check ownership
    if (post.authorId !== userId) {
      throw new PostServiceError(
        'You can only delete your own posts',
        'UNAUTHORIZED'
      );
    }

    // Soft delete
    const deletedPost = await this.postRepository.softDelete(postId);

    // Emit event
    this.eventEmitter.emit('post.deleted', {
      postId: deletedPost.id,
      authorId: deletedPost.authorId,
      groupId: deletedPost.groupId,
      deletedAt: deletedPost.updatedAt,
    });

    // Invalidate caches
    await this.cacheService.delete(CacheKeyBuilder.post(postId));
    await this.invalidateFeedCaches(deletedPost.authorId, deletedPost.groupId);

    return deletedPost;
  }

  /**
   * Get a single post by ID
   * - Checks cache first
   * - Returns null for deleted posts
   */
  async getPost(postId: string): Promise<Post> {
    // Check cache first
    const cacheKey = CacheKeyBuilder.post(postId);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      const post = JSON.parse(cached);
      // Ensure dates are properly parsed
      post.createdAt = new Date(post.createdAt);
      post.updatedAt = new Date(post.updatedAt);
      return post;
    }

    // Fetch from database
    const post = await this.postRepository.findById(postId);

    if (!post || post.isDeleted) {
      throw new PostServiceError('Post not found', 'POST_NOT_FOUND');
    }

    // Cache the result
    await this.cacheService.set(
      cacheKey,
      JSON.stringify(post),
      POST_CONSTANTS.POST_CACHE_TTL
    );

    return post;
  }

  /**
   * Get post with author information
   */
  async getPostWithAuthor(postId: string): Promise<Post> {
    const post = await this.postRepository.findByIdWithAuthor(postId);

    if (!post || post.isDeleted) {
      throw new PostServiceError('Post not found', 'POST_NOT_FOUND');
    }

    return post;
  }

  /**
   * Invalidate feed caches when a post is created/updated/deleted
   */
  private async invalidateFeedCaches(
    authorId: string,
    groupId?: string | null
  ): Promise<void> {
    // Invalidate user's profile feed
    await this.cacheService.invalidatePattern(
      CacheKeyBuilder.userProfileFeedPattern(authorId)
    );

    // Invalidate group feed if applicable
    if (groupId) {
      await this.cacheService.invalidatePattern(
        CacheKeyBuilder.groupFeedPattern(groupId)
      );
    }

    // Invalidate home feeds (simplified - in production, would target followers only)
    await this.cacheService.invalidatePattern('feed:home:*');
  }
}
