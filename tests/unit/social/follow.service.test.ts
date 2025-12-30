/**
 * Follow Service Unit Tests - London School TDD
 *
 * These tests follow the London School (mockist) approach:
 * - Focus on behavior verification over state verification
 * - Use mocks to isolate the unit under test
 * - Define contracts through mock expectations
 * - Test object collaborations and interactions
 *
 * TDD RED Phase: All tests should fail initially
 */

import { FollowService } from '../../../src/social/follow.service';
import {
  IFollowRepository,
  IBlockRepository,
  IUserProfileRepository,
  IEventPublisher,
  Follow,
  FollowStatus,
  UserProfile,
  Block,
  SelfFollowError,
  UserBlockedError,
  UserNotFoundError,
  AlreadyFollowingError,
  NotFollowingError,
  FollowRequestNotFoundError,
} from '../../../src/social/social.types';

// ============================================================
// MOCK FACTORIES
// ============================================================

const createMockFollow = (overrides: Partial<Follow> = {}): Follow => ({
  id: 'follow-123',
  followerId: 'user-1',
  followingId: 'user-2',
  status: FollowStatus.ACTIVE,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'profile-123',
  userId: 'user-2',
  displayName: 'Test User',
  bio: null,
  avatarUrl: null,
  isPrivate: false,
  followApprovalRequired: false,
  followerCount: 0,
  followingCount: 0,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
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

const createMockBlockRepository = (): jest.Mocked<IBlockRepository> => ({
  create: jest.fn(),
  findByPair: jest.fn(),
  delete: jest.fn(),
  deleteByPair: jest.fn(),
  findBlocks: jest.fn(),
  isBlocked: jest.fn(),
  isBidirectionallyBlocked: jest.fn(),
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

describe('FollowService', () => {
  let followService: FollowService;
  let mockFollowRepository: jest.Mocked<IFollowRepository>;
  let mockBlockRepository: jest.Mocked<IBlockRepository>;
  let mockUserProfileRepository: jest.Mocked<IUserProfileRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockFollowRepository = createMockFollowRepository();
    mockBlockRepository = createMockBlockRepository();
    mockUserProfileRepository = createMockUserProfileRepository();
    mockEventPublisher = createMockEventPublisher();

    followService = new FollowService(
      mockFollowRepository,
      mockBlockRepository,
      mockUserProfileRepository,
      mockEventPublisher
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // FOLLOW TESTS
  // ============================================================

  describe('follow()', () => {
    describe('when following a public user', () => {
      it('should succeed immediately with active status', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';
        const mockProfile = createMockUserProfile({
          userId: followingId,
          isPrivate: false,
          followApprovalRequired: false,
        });
        const mockFollow = createMockFollow({
          followerId,
          followingId,
          status: FollowStatus.ACTIVE,
        });

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockUserProfileRepository.findByUserId.mockResolvedValue(mockProfile);
        mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);
        mockFollowRepository.findByPair.mockResolvedValue(null);
        mockFollowRepository.create.mockResolvedValue(mockFollow);

        // Act
        const result = await followService.follow(followerId, followingId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.status).toBe('followed');
        expect(result.follow?.status).toBe(FollowStatus.ACTIVE);

        // Verify collaborations (London School focus)
        expect(mockUserProfileRepository.exists).toHaveBeenCalledWith(followingId);
        expect(mockBlockRepository.isBidirectionallyBlocked).toHaveBeenCalledWith(
          followerId,
          followingId
        );
        expect(mockFollowRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            followerId,
            followingId,
            status: FollowStatus.ACTIVE,
          })
        );
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'follow.created',
            followerId,
            followingId,
          })
        );
      });
    });

    describe('when following a private user', () => {
      it('should create a pending follow request', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';
        const mockProfile = createMockUserProfile({
          userId: followingId,
          isPrivate: true,
          followApprovalRequired: true,
        });
        const mockFollow = createMockFollow({
          followerId,
          followingId,
          status: FollowStatus.PENDING,
        });

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockUserProfileRepository.findByUserId.mockResolvedValue(mockProfile);
        mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);
        mockFollowRepository.findByPair.mockResolvedValue(null);
        mockFollowRepository.create.mockResolvedValue(mockFollow);

        // Act
        const result = await followService.follow(followerId, followingId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.status).toBe('pending');
        expect(result.follow?.status).toBe(FollowStatus.PENDING);

        // Verify the follow request event was published
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'follow.requested',
            followerId,
            followingId,
            status: FollowStatus.PENDING,
          })
        );
      });
    });

    describe('when trying to follow self', () => {
      it('should fail with SelfFollowError', async () => {
        // Arrange
        const userId = 'user-1';

        // Act & Assert
        await expect(followService.follow(userId, userId)).rejects.toThrow(
          SelfFollowError
        );

        // Verify no repository calls were made
        expect(mockFollowRepository.create).not.toHaveBeenCalled();
        expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      });
    });

    describe('when user is blocked', () => {
      it('should fail with UserBlockedError', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(true);

        // Act & Assert
        await expect(
          followService.follow(followerId, followingId)
        ).rejects.toThrow(UserBlockedError);

        // Verify the block check was performed
        expect(mockBlockRepository.isBidirectionallyBlocked).toHaveBeenCalledWith(
          followerId,
          followingId
        );
        expect(mockFollowRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('when target user does not exist', () => {
      it('should fail with UserNotFoundError', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'non-existent-user';

        mockUserProfileRepository.exists.mockResolvedValue(false);

        // Act & Assert
        await expect(
          followService.follow(followerId, followingId)
        ).rejects.toThrow(UserNotFoundError);

        expect(mockFollowRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('when already following', () => {
      it('should return already_following status', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';
        const existingFollow = createMockFollow({
          followerId,
          followingId,
          status: FollowStatus.ACTIVE,
        });

        mockUserProfileRepository.exists.mockResolvedValue(true);
        mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);
        mockFollowRepository.findByPair.mockResolvedValue(existingFollow);

        // Act
        const result = await followService.follow(followerId, followingId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.status).toBe('already_following');
        expect(mockFollowRepository.create).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // UNFOLLOW TESTS
  // ============================================================

  describe('unfollow()', () => {
    describe('when unfollowing an existing follow', () => {
      it('should remove the relationship successfully', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';
        const existingFollow = createMockFollow({
          id: 'follow-123',
          followerId,
          followingId,
          status: FollowStatus.ACTIVE,
        });

        mockFollowRepository.findByPair.mockResolvedValue(existingFollow);
        mockFollowRepository.delete.mockResolvedValue();

        // Act
        const result = await followService.unfollow(followerId, followingId);

        // Assert
        expect(result.success).toBe(true);
        expect(mockFollowRepository.delete).toHaveBeenCalledWith('follow-123');
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'follow.removed',
            followerId,
            followingId,
          })
        );
      });
    });

    describe('when not following the user', () => {
      it('should fail with NotFollowingError', async () => {
        // Arrange
        const followerId = 'user-1';
        const followingId = 'user-2';

        mockFollowRepository.findByPair.mockResolvedValue(null);

        // Act & Assert
        await expect(
          followService.unfollow(followerId, followingId)
        ).rejects.toThrow(NotFollowingError);

        expect(mockFollowRepository.delete).not.toHaveBeenCalled();
      });
    });

    describe('when trying to unfollow self', () => {
      it('should fail with SelfFollowError', async () => {
        // Arrange
        const userId = 'user-1';

        // Act & Assert
        await expect(followService.unfollow(userId, userId)).rejects.toThrow(
          SelfFollowError
        );
      });
    });
  });

  // ============================================================
  // APPROVE FOLLOW REQUEST TESTS
  // ============================================================

  describe('approveFollowRequest()', () => {
    describe('when approving a valid pending request', () => {
      it('should activate the follow relationship', async () => {
        // Arrange
        const ownerId = 'user-2'; // The one being followed
        const requesterId = 'user-1'; // The one who wants to follow
        const pendingFollow = createMockFollow({
          id: 'follow-123',
          followerId: requesterId,
          followingId: ownerId,
          status: FollowStatus.PENDING,
        });
        const activatedFollow = createMockFollow({
          ...pendingFollow,
          status: FollowStatus.ACTIVE,
        });

        mockFollowRepository.findByPair.mockResolvedValue(pendingFollow);
        mockFollowRepository.updateStatus.mockResolvedValue(activatedFollow);

        // Act
        const result = await followService.approveFollowRequest(
          ownerId,
          requesterId
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.follow?.status).toBe(FollowStatus.ACTIVE);
        expect(mockFollowRepository.updateStatus).toHaveBeenCalledWith(
          'follow-123',
          FollowStatus.ACTIVE
        );
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'follow.approved',
            followerId: requesterId,
            followingId: ownerId,
          })
        );
      });
    });

    describe('when no pending request exists', () => {
      it('should fail with FollowRequestNotFoundError', async () => {
        // Arrange
        const ownerId = 'user-2';
        const requesterId = 'user-1';

        mockFollowRepository.findByPair.mockResolvedValue(null);

        // Act & Assert
        await expect(
          followService.approveFollowRequest(ownerId, requesterId)
        ).rejects.toThrow(FollowRequestNotFoundError);
      });
    });

    describe('when the request is already active', () => {
      it('should fail with FollowRequestNotFoundError', async () => {
        // Arrange
        const ownerId = 'user-2';
        const requesterId = 'user-1';
        const activeFollow = createMockFollow({
          followerId: requesterId,
          followingId: ownerId,
          status: FollowStatus.ACTIVE,
        });

        mockFollowRepository.findByPair.mockResolvedValue(activeFollow);

        // Act & Assert
        await expect(
          followService.approveFollowRequest(ownerId, requesterId)
        ).rejects.toThrow(FollowRequestNotFoundError);
      });
    });
  });

  // ============================================================
  // REJECT FOLLOW REQUEST TESTS
  // ============================================================

  describe('rejectFollowRequest()', () => {
    describe('when rejecting a valid pending request', () => {
      it('should delete the follow request', async () => {
        // Arrange
        const ownerId = 'user-2';
        const requesterId = 'user-1';
        const pendingFollow = createMockFollow({
          id: 'follow-123',
          followerId: requesterId,
          followingId: ownerId,
          status: FollowStatus.PENDING,
        });

        mockFollowRepository.findByPair.mockResolvedValue(pendingFollow);
        mockFollowRepository.delete.mockResolvedValue();

        // Act
        const result = await followService.rejectFollowRequest(
          ownerId,
          requesterId
        );

        // Assert
        expect(result.success).toBe(true);
        expect(mockFollowRepository.delete).toHaveBeenCalledWith('follow-123');
      });
    });

    describe('when no pending request exists', () => {
      it('should fail with FollowRequestNotFoundError', async () => {
        // Arrange
        const ownerId = 'user-2';
        const requesterId = 'user-1';

        mockFollowRepository.findByPair.mockResolvedValue(null);

        // Act & Assert
        await expect(
          followService.rejectFollowRequest(ownerId, requesterId)
        ).rejects.toThrow(FollowRequestNotFoundError);
      });
    });
  });

  // ============================================================
  // GET FOLLOWERS TESTS
  // ============================================================

  describe('getFollowers()', () => {
    it('should return paginated list of followers', async () => {
      // Arrange
      const userId = 'user-1';
      const mockFollows = [
        createMockFollow({
          id: 'follow-1',
          followerId: 'user-2',
          followingId: userId,
        }),
        createMockFollow({
          id: 'follow-2',
          followerId: 'user-3',
          followingId: userId,
        }),
      ];
      const mockProfiles = [
        createMockUserProfile({
          userId: 'user-2',
          displayName: 'User Two',
          avatarUrl: 'https://example.com/avatar2.jpg',
        }),
        createMockUserProfile({
          userId: 'user-3',
          displayName: 'User Three',
          avatarUrl: null,
        }),
      ];

      mockFollowRepository.findFollowers.mockResolvedValue({
        data: mockFollows,
        total: 2,
      });
      mockUserProfileRepository.findByUserId
        .mockResolvedValueOnce(mockProfiles[0])
        .mockResolvedValueOnce(mockProfiles[1]);

      // Act
      const result = await followService.getFollowers(userId, {
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data[0].displayName).toBe('User Two');
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(mockFollowRepository.findFollowers).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 20,
      });
    });

    it('should handle empty followers list', async () => {
      // Arrange
      const userId = 'user-1';

      mockFollowRepository.findFollowers.mockResolvedValue({
        data: [],
        total: 0,
      });

      // Act
      const result = await followService.getFollowers(userId);

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ============================================================
  // GET FOLLOWING TESTS
  // ============================================================

  describe('getFollowing()', () => {
    it('should return paginated list of users being followed', async () => {
      // Arrange
      const userId = 'user-1';
      const mockFollows = [
        createMockFollow({
          id: 'follow-1',
          followerId: userId,
          followingId: 'user-2',
        }),
      ];
      const mockProfile = createMockUserProfile({
        userId: 'user-2',
        displayName: 'User Two',
      });

      mockFollowRepository.findFollowing.mockResolvedValue({
        data: mockFollows,
        total: 1,
      });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockProfile);

      // Act
      const result = await followService.getFollowing(userId, {
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-2');
      expect(result.pagination.total).toBe(1);
      expect(mockFollowRepository.findFollowing).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 20,
      });
    });
  });

  // ============================================================
  // GET RELATIONSHIP TESTS
  // ============================================================

  describe('getRelationship()', () => {
    it('should return mutual following relationship', async () => {
      // Arrange
      const userId = 'user-1';
      const targetId = 'user-2';

      // User 1 follows User 2 (active)
      mockFollowRepository.findByPair
        .mockResolvedValueOnce(
          createMockFollow({
            followerId: userId,
            followingId: targetId,
            status: FollowStatus.ACTIVE,
          })
        )
        // User 2 follows User 1 (active)
        .mockResolvedValueOnce(
          createMockFollow({
            followerId: targetId,
            followingId: userId,
            status: FollowStatus.ACTIVE,
          })
        );
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);

      // Act
      const result = await followService.getRelationship(userId, targetId);

      // Assert
      expect(result.isFollowing).toBe(true);
      expect(result.isFollowedBy).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.followStatus).toBe('following');
    });

    it('should indicate pending follow status', async () => {
      // Arrange
      const userId = 'user-1';
      const targetId = 'user-2';

      mockFollowRepository.findByPair
        .mockResolvedValueOnce(
          createMockFollow({
            followerId: userId,
            followingId: targetId,
            status: FollowStatus.PENDING,
          })
        )
        .mockResolvedValueOnce(null);
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);

      // Act
      const result = await followService.getRelationship(userId, targetId);

      // Assert
      expect(result.isFollowing).toBe(false);
      expect(result.followStatus).toBe('pending');
    });

    it('should indicate blocked status', async () => {
      // Arrange
      const userId = 'user-1';
      const targetId = 'user-2';

      mockFollowRepository.findByPair.mockResolvedValue(null);
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(true);

      // Act
      const result = await followService.getRelationship(userId, targetId);

      // Assert
      expect(result.isBlocked).toBe(true);
      expect(result.followStatus).toBe('blocked');
    });
  });
});

// ============================================================
// EDGE CASE TESTS
// ============================================================

describe('FollowService Edge Cases', () => {
  let followService: FollowService;
  let mockFollowRepository: jest.Mocked<IFollowRepository>;
  let mockBlockRepository: jest.Mocked<IBlockRepository>;
  let mockUserProfileRepository: jest.Mocked<IUserProfileRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockFollowRepository = createMockFollowRepository();
    mockBlockRepository = createMockBlockRepository();
    mockUserProfileRepository = createMockUserProfileRepository();
    mockEventPublisher = createMockEventPublisher();

    followService = new FollowService(
      mockFollowRepository,
      mockBlockRepository,
      mockUserProfileRepository,
      mockEventPublisher
    );
  });

  describe('concurrent follow requests', () => {
    it('should handle race conditions gracefully', async () => {
      // This test verifies idempotent behavior
      const followerId = 'user-1';
      const followingId = 'user-2';

      // First call: no existing follow
      mockUserProfileRepository.exists.mockResolvedValue(true);
      mockUserProfileRepository.findByUserId.mockResolvedValue(
        createMockUserProfile({ userId: followingId })
      );
      mockBlockRepository.isBidirectionallyBlocked.mockResolvedValue(false);
      mockFollowRepository.findByPair.mockResolvedValue(null);
      mockFollowRepository.create.mockResolvedValue(
        createMockFollow({ followerId, followingId })
      );

      const result = await followService.follow(followerId, followingId);
      expect(result.status).toBe('followed');
    });
  });

  describe('pagination edge cases', () => {
    it('should handle page beyond available data', async () => {
      mockFollowRepository.findFollowers.mockResolvedValue({
        data: [],
        total: 5,
      });

      const result = await followService.getFollowers('user-1', {
        page: 100,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should apply default pagination when not specified', async () => {
      mockFollowRepository.findFollowers.mockResolvedValue({
        data: [],
        total: 0,
      });

      await followService.getFollowers('user-1');

      expect(mockFollowRepository.findFollowers).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          page: 1,
          limit: 20,
        })
      );
    });
  });
});
