/**
 * Block Service - User Blocking Management
 * M6 Social Graph & Follow System
 *
 * This service handles all block/unblock operations with
 * cascade effects on follow relationships.
 *
 * Performance Targets:
 * - Block check: <20ms p95
 * - Block operations: <50ms p95
 */

import {
  IBlockRepository,
  IFollowRepository,
  IUserProfileRepository,
  IEventPublisher,
  IBlockService,
  Block,
  BlockResult,
  UnblockResult,
  PaginationOptions,
  Pagination,
  SelfBlockError,
  AlreadyBlockedError,
  NotBlockedError,
  UserNotFoundError,
} from './social.types';

export class BlockService implements IBlockService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 100;

  constructor(
    private readonly blockRepository: IBlockRepository,
    private readonly followRepository: IFollowRepository,
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly eventPublisher: IEventPublisher
  ) {}

  /**
   * Block a user.
   *
   * Business Rules:
   * - Cannot block yourself
   * - Cannot block if already blocked
   * - Blocking removes all follow relationships (bidirectional)
   * - Blocked user cannot see blocker's content and vice versa
   *
   * @param blockerId - ID of the user initiating the block
   * @param blockedId - ID of the user to be blocked
   * @param reason - Optional reason for blocking
   * @returns BlockResult
   */
  async block(
    blockerId: string,
    blockedId: string,
    reason?: string
  ): Promise<BlockResult> {
    // Rule: Cannot block yourself
    if (blockerId === blockedId) {
      throw new SelfBlockError();
    }

    // Verify target user exists
    const userExists = await this.userProfileRepository.exists(blockedId);
    if (!userExists) {
      throw new UserNotFoundError(blockedId);
    }

    // Check if already blocked
    const existingBlock = await this.blockRepository.findByPair(blockerId, blockedId);
    if (existingBlock) {
      throw new AlreadyBlockedError();
    }

    // Create the block relationship
    const block = await this.blockRepository.create({
      blockerId,
      blockedId,
      reason,
    });

    // Cascade: Remove all follow relationships between these users (bidirectional)
    await Promise.all([
      this.followRepository.deleteByPair(blockerId, blockedId),
      this.followRepository.deleteByPair(blockedId, blockerId),
    ]);

    // Publish block event
    await this.eventPublisher.publish({
      type: 'block.created',
      blockerId,
      blockedId,
      timestamp: new Date(),
    });

    return {
      success: true,
      block,
      message: 'User blocked successfully',
    };
  }

  /**
   * Unblock a user.
   *
   * @param blockerId - ID of the user initiating the unblock
   * @param blockedId - ID of the user to be unblocked
   * @returns UnblockResult
   */
  async unblock(blockerId: string, blockedId: string): Promise<UnblockResult> {
    // Rule: Cannot unblock yourself
    if (blockerId === blockedId) {
      throw new SelfBlockError();
    }

    // Find existing block
    const existingBlock = await this.blockRepository.findByPair(blockerId, blockedId);
    if (!existingBlock) {
      throw new NotBlockedError();
    }

    // Delete the block relationship
    await this.blockRepository.delete(existingBlock.id);

    // Publish unblock event
    await this.eventPublisher.publish({
      type: 'block.removed',
      blockerId,
      blockedId,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: 'User unblocked successfully',
    };
  }

  /**
   * Check if there is a block relationship between two users (bidirectional).
   *
   * This checks if either user has blocked the other.
   *
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns true if either user has blocked the other
   */
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    return this.blockRepository.isBidirectionallyBlocked(userId1, userId2);
  }

  /**
   * Get paginated list of users blocked by a user.
   *
   * @param userId - ID of the user to get blocks for
   * @param options - Pagination options
   * @returns Paginated list of blocks
   */
  async getBlocks(
    userId: string,
    options?: PaginationOptions
  ): Promise<{ data: Block[]; pagination: Pagination }> {
    const page = options?.page || this.DEFAULT_PAGE;
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const { data, total } = await this.blockRepository.findBlocks(userId, {
      page,
      limit,
    });

    const pagination = this.createPagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Create pagination object.
   */
  private createPagination(page: number, limit: number, total: number): Pagination {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
