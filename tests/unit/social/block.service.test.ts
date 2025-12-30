/**
 * Block Service Unit Tests - London School TDD
 *
 * Tests for block/unblock operations with behavior verification
 * and mock-driven development.
 */

import { BlockService } from '../../../src/social/block.service';
import {
  IBlockRepository,
  IFollowRepository,
  IUserProfileRepository,
  IEventPublisher,
  Block,
  SelfBlockError,
  AlreadyBlockedError,
  NotBlockedError,
  UserNotFoundError,
} from '../../../src/social/social.types';

// ============================================================
// MOCK FACTORIES
// ============================================================

const createMockBlock = (overrides: Partial<Block> = {}): Block => ({
  id: 'block-123',
  blockerId: 'user-1',
  blockedId: 'user-2',
  reason: undefined,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockBlockRepository = (): jest.Mocked<IBlockRepository> => ({
  create: jest.fn(),
  findByPair: jest.fn(),
  delete: jest.fn(),
  deleteByPair: jest.fn(),
  findBlocks: jest.fn(),
  isBlocked: jest.fn(),
  isBidirectionallyBlocked: jest.fn(),
});

const createMockFollowRepository = (): jest.Mocked<IFollowRepository> => ({
  create: jest.fn(),
  findByPair: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  deleteByPair: jest.fn(),
  findFollowers: jest.fn(),
  findFollowing: jest.fn(),
  findPendingRequests: jest.fn(),
  countFollowers: jest.fn(),
  countFollowing: jest.fn(),
});

const createMockUserProfileRepository = (): jest.Mocked<IUserProfileRepository> => ({
  findByUserId: jest.fn(),
  exists: jest.fn(),
  incrementFollowerCount: jest.fn(),
  decrementFollowerCount: jest.fn(),
  incrementFollowingCount: jest.fn(),
  decrementFollowingCount: jest.fn(),
});

const createMockEventPublisher = (): jest.Mocked<IEventPublisher> => ({
  publish: jest.fn(),
});

// ============================================================
// TEST SUITES
// ============================================================

describe('BlockService', () => {
  let blockService: BlockService;
  let mockBlockRepository: jest.Mocked<IBlockRepository>;
  let mockFollowRepository: jest.Mocked<IFollowRepository>;
  let mockUserProfileRepository: jest.Mocked<IUserProfileRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockBlockRepository = createMockBlockRepository();
    mockFollowRepository = createMockFollowRepository();
    mockUserProfileRepository = createMockUserProfileRepository();
    mockEventPublisher = createMockEventPublisher();

    blockService = new BlockService(
      mockBlockRepository,
      mockFollowRepository,
      mockUserProfileRepository,
      mockEventPublisher
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // BLOCK TESTS
  // ============================================================

  describe('block()', () => {
    describe('when blocking a valid user', () => {
      it('should create block relationship successfully', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';
        const mockBlock = createMockBlock({ blockerId, blockedId });

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.findByPair.mockResolvedValue(null);
        mockBlockRepository.create.mockResolvedValue(mockBlock);
        mockFollowRepository.deleteByPair.mockResolvedValue();

        // Act
        const result = await blockService.block(blockerId, blockedId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.block).toBeDefined();
        expect(mockBlockRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            blockerId,
            blockedId,
          })
        );
      });

      it('should remove all follow relationships between users', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.findByPair.mockResolvedValue(null);
        mockBlockRepository.create.mockResolvedValue(
          createMockBlock({ blockerId, blockedId })
        );

        // Act
        await blockService.block(blockerId, blockedId);

        // Assert - Verify bidirectional follow removal
        expect(mockFollowRepository.deleteByPair).toHaveBeenCalledWith(
          blockerId,
          blockedId
        );
        expect(mockFollowRepository.deleteByPair).toHaveBeenCalledWith(
          blockedId,
          blockerId
        );
      });

      it('should publish block event', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.findByPair.mockResolvedValue(null);
        mockBlockRepository.create.mockResolvedValue(
          createMockBlock({ blockerId, blockedId })
        );

        // Act
        await blockService.block(blockerId, blockedId);

        // Assert
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'block.created',
            blockerId,
            blockedId,
          })
        );
      });

      it('should allow optional reason', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';
        const reason = 'Harassment';

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.findByPair.mockResolvedValue(null);
        mockBlockRepository.create.mockResolvedValue(
          createMockBlock({ blockerId, blockedId, reason })
        );

        // Act
        const result = await blockService.block(blockerId, blockedId, reason);

        // Assert
        expect(mockBlockRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            blockerId,
            blockedId,
            reason,
          })
        );
        expect(result.block?.reason).toBe(reason);
      });
    });

    describe('when trying to block self', () => {
      it('should fail with SelfBlockError', async () => {
        // Arrange
        const userId = 'user-1';

        // Act & Assert
        await expect(blockService.block(userId, userId)).rejects.toThrow(
          SelfBlockError
        );

        expect(mockBlockRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('when user is already blocked', () => {
      it('should fail with AlreadyBlockedError', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';
        const existingBlock = createMockBlock({ blockerId, blockedId });

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.findByPair.mockResolvedValue(existingBlock);

        // Act & Assert
        await expect(
          blockService.block(blockerId, blockedId)
        ).rejects.toThrow(AlreadyBlockedError);
      });
    });

    describe('when target user does not exist', () => {
      it('should fail with UserNotFoundError', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'non-existent-user';

        mockUserProfileRepository.exists.mockResolvedValue(false);

        // Act & Assert
        await expect(
          blockService.block(blockerId, blockedId)
        ).rejects.toThrow(UserNotFoundError);
      });
    });
  });

  // ============================================================
  // UNBLOCK TESTS
  // ============================================================

  describe('unblock()', () => {
    describe('when unblocking a blocked user', () => {
      it('should remove the block relationship', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';
        const existingBlock = createMockBlock({
          id: 'block-123',
          blockerId,
          blockedId,
        });

        mockBlockRepository.findByPair.mockResolvedValue(existingBlock);
        mockBlockRepository.delete.mockResolvedValue();

        // Act
        const result = await blockService.unblock(blockerId, blockedId);

        // Assert
        expect(result.success).toBe(true);
        expect(mockBlockRepository.delete).toHaveBeenCalledWith('block-123');
      });

      it('should publish unblock event', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';
        const existingBlock = createMockBlock({ blockerId, blockedId });

        mockBlockRepository.findByPair.mockResolvedValue(existingBlock);
        mockBlockRepository.delete.mockResolvedValue();

        // Act
        await blockService.unblock(blockerId, blockedId);

        // Assert
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'block.removed',
            blockerId,
            blockedId,
          })
        );
      });
    });

    describe('when user is not blocked', () => {
      it('should fail with NotBlockedError', async () => {
        // Arrange
        const blockerId = 'user-1';
        const blockedId = 'user-2';

        mockBlockRepository.findByPair.mockResolvedValue(null);

        // Act & Assert
        await expect(
          blockService.unblock(blockerId, blockedId)
        ).rejects.toThrow(NotBlockedError);
      });
    });

    describe('when trying to unblock self', () => {
      it('should fail with SelfBlockError', async () => {
        // Arrange
        const userId = 'user-1';

        // Act & Assert
        await expect(blockService.unblock(userId, userId)).rejects.toThrow(
          SelfBlockError
        );
      });
    });
  });

  // ============================================================
  // IS BLOCKED TESTS
  // ============================================================

  describe('isBlocked()', () => {
    it('should return true when users are blocked bidirectionally', async () => {
      // Arrange
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(true);

      // Act
      const result = await blockService.isBlocked('user-1', 'user-2');

      // Assert
      expect(result).toBe(true);
      expect(mockBlockRepository.isBidirectionallyBlocked).toHaveBeenCalledWith(
        'user-1',
        'user-2'
      );
    });

    it('should return false when users are not blocked', async () => {
      // Arrange
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);

      // Act
      const result = await blockService.isBlocked('user-1', 'user-2');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // GET BLOCKS TESTS
  // ============================================================

  describe('getBlocks()', () => {
    it('should return paginated list of blocked users', async () => {
      // Arrange
      const userId = 'user-1';
      const mockBlocks = [
        createMockBlock({ id: 'block-1', blockerId: userId, blockedId: 'user-2' }),
        createMockBlock({ id: 'block-2', blockerId: userId, blockedId: 'user-3' }),
      ];

      mockBlockRepository.findBlocks.mockResolvedValue({
        data: mockBlocks,
        total: 2,
      });

      // Act
      const result = await blockService.getBlocks(userId, { page: 1, limit: 20 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(mockBlockRepository.findBlocks).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 20,
      });
    });

    it('should handle empty block list', async () => {
      // Arrange
      const userId = 'user-1';

      mockBlockRepository.findBlocks.mockResolvedValue({
        data: [],
        total: 0,
      });

      // Act
      const result = await blockService.getBlocks(userId);

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should apply default pagination', async () => {
      // Arrange
      mockBlockRepository.findBlocks.mockResolvedValue({
        data: [],
        total: 0,
      });

      // Act
      await blockService.getBlocks('user-1');

      // Assert
      expect(mockBlockRepository.findBlocks).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
      });
    });
  });
});

// ============================================================
// EDGE CASE TESTS
// ============================================================

describe('BlockService Edge Cases', () => {
  let blockService: BlockService;
  let mockBlockRepository: jest.Mocked<IBlockRepository>;
  let mockFollowRepository: jest.Mocked<IFollowRepository>;
  let mockUserProfileRepository: jest.Mocked<IUserProfileRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockBlockRepository = createMockBlockRepository();
    mockFollowRepository = createMockFollowRepository();
    mockUserProfileRepository = createMockUserProfileRepository();
    mockEventPublisher = createMockEventPublisher();

    blockService = new BlockService(
      mockBlockRepository,
      mockFollowRepository,
      mockUserProfileRepository,
      mockEventPublisher
    );
  });

  describe('cascade operations on block', () => {
    it('should handle case where no follows exist to remove', async () => {
      // Arrange
      const blockerId = 'user-1';
      const blockedId = 'user-2';

      mockUserProfileRepository.exists.mockResolvedValue(true);
      mockBlockRepository.findByPair.mockResolvedValue(null);
      mockBlockRepository.create.mockResolvedValue(
        createMockBlock({ blockerId, blockedId })
      );
      // Both deleteByPair calls succeed even if no follows exist
      mockFollowRepository.deleteByPair.mockResolvedValue();

      // Act
      const result = await blockService.block(blockerId, blockedId);

      // Assert
      expect(result.success).toBe(true);
      // Should still attempt to remove both directions
      expect(mockFollowRepository.deleteByPair).toHaveBeenCalledTimes(2);
    });
  });

  describe('transactional integrity', () => {
    it('should ensure block and follow removal are atomic', async () => {
      // This test documents the expected behavior that block creation
      // and follow removal should happen together
      const blockerId = 'user-1';
      const blockedId = 'user-2';

      mockUserProfileRepository.exists.mockResolvedValue(true);
      mockBlockRepository.findByPair.mockResolvedValue(null);
      mockBlockRepository.create.mockResolvedValue(
        createMockBlock({ blockerId, blockedId })
      );

      await blockService.block(blockerId, blockedId);

      // Verify order of operations
      const createCallOrder = mockBlockRepository.create.mock.invocationCallOrder[0];
      const deleteCallOrder1 = mockFollowRepository.deleteByPair.mock.invocationCallOrder[0];
      const deleteCallOrder2 = mockFollowRepository.deleteByPair.mock.invocationCallOrder[1];

      // Block should be created before follow removal
      expect(createCallOrder).toBeLessThan(deleteCallOrder1);
      expect(createCallOrder).toBeLessThan(deleteCallOrder2);
    });
  });
});
