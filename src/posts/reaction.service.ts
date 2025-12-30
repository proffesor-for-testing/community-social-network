/**
 * Reaction Service
 * Business logic for post reactions
 * Implements TDD GREEN phase requirements
 *
 * Features:
 * - Toggle reactions (add/remove)
 * - One reaction per user per post
 * - Change reaction type
 * - Reaction type validation
 */

import { EventEmitter } from 'events';
import { ReactionRepository } from './reaction.repository';
import { PostRepository } from './post.repository';
import { CacheService, CacheKeyBuilder } from './cache.service';
import {
  Reaction,
  ReactionType,
  ReactionCounts,
  ToggleReactionResult,
  VALID_REACTION_TYPES,
  isValidReactionType,
  POST_CONSTANTS,
} from './types';

// Re-export ReactionType for external use
export { ReactionType } from './types';

export class ReactionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReactionServiceError';
  }
}

export class ReactionService {
  constructor(
    private readonly reactionRepository: ReactionRepository,
    private readonly postRepository: PostRepository,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter
  ) {}

  /**
   * Toggle a reaction on a post
   * - Add if user hasn't reacted
   * - Remove if clicking same reaction
   * - Change if clicking different reaction
   */
  async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<ToggleReactionResult> {
    // Validate reaction type
    if (!isValidReactionType(reactionType)) {
      throw new ReactionServiceError(
        'Invalid reaction type',
        'INVALID_REACTION_TYPE'
      );
    }

    // Check if post exists and is not deleted
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new ReactionServiceError('Post not found', 'POST_NOT_FOUND');
    }

    if (post.isDeleted) {
      throw new ReactionServiceError(
        'Cannot react to deleted post',
        'POST_DELETED'
      );
    }

    // Check if user already has a reaction
    const existingReaction = await this.reactionRepository.findByUserAndPost(
      userId,
      postId
    );

    let result: ToggleReactionResult;

    if (!existingReaction) {
      // No existing reaction - add new one
      const newReaction = await this.reactionRepository.upsert({
        userId,
        postId,
        type: reactionType,
      });

      // Increment post likes count
      await this.postRepository.incrementLikesCount(postId);

      // Emit event
      this.eventEmitter.emit('reaction.added', {
        postId,
        userId,
        authorId: post.authorId,
        reactionType,
        reactionId: newReaction.id,
      });

      result = { action: 'added', reaction: newReaction };
    } else if (existingReaction.type === reactionType) {
      // Same reaction type - remove it
      await this.reactionRepository.delete(existingReaction.id);

      // Decrement post likes count
      await this.postRepository.decrementLikesCount(postId);

      // Emit event
      this.eventEmitter.emit('reaction.removed', {
        postId,
        userId,
        reactionType,
      });

      result = { action: 'removed', reaction: null };
    } else {
      // Different reaction type - change it
      const updatedReaction = await this.reactionRepository.upsert({
        userId,
        postId,
        type: reactionType,
      });

      // Emit event
      this.eventEmitter.emit('reaction.changed', {
        postId,
        userId,
        previousType: existingReaction.type,
        newType: reactionType,
      });

      result = { action: 'changed', reaction: updatedReaction };
    }

    // Invalidate reaction cache
    await this.cacheService.delete(CacheKeyBuilder.postReactions(postId));

    return result;
  }

  /**
   * Get reaction counts for a post
   */
  async getReactionCounts(postId: string): Promise<ReactionCounts> {
    // Check cache first
    const cacheKey = CacheKeyBuilder.postReactions(postId);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const counts = await this.reactionRepository.getReactionCounts(postId);

    // Cache the result
    await this.cacheService.set(
      cacheKey,
      JSON.stringify(counts),
      POST_CONSTANTS.REACTION_CACHE_TTL
    );

    return counts;
  }

  /**
   * Get user's reaction for a post
   */
  async getUserReaction(
    postId: string,
    userId: string
  ): Promise<Reaction | null> {
    return this.reactionRepository.getUserReaction(userId, postId);
  }

  /**
   * Get valid reaction types
   */
  getValidReactionTypes(): ReactionType[] {
    return [...VALID_REACTION_TYPES];
  }

  /**
   * Validate a reaction type
   */
  isValidReactionType(type: string): boolean {
    return isValidReactionType(type);
  }
}
