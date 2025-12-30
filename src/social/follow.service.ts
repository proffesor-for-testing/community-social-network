/**
 * Follow Service - Social Graph Management
 * M6 Social Graph & Follow System
 *
 * This service handles all follow/unfollow operations following
 * the London School TDD approach with dependency injection.
 *
 * Performance Targets:
 * - Follow/unfollow: <50ms p95
 * - Get followers/following: <100ms p95
 */

import {
  IFollowRepository,
  IBlockRepository,
  IUserProfileRepository,
  IEventPublisher,
  IFollowService,
  Follow,
  FollowStatus,
  FollowResult,
  UnfollowResult,
  ApproveRejectResult,
  PaginatedFollowers,
  PaginatedFollowing,
  Relationship,
  RelationshipStatus,
  PaginationOptions,
  Pagination,
  FollowerInfo,
  FollowingInfo,
  SelfFollowError,
  UserBlockedError,
  UserNotFoundError,
  NotFollowingError,
  FollowRequestNotFoundError,
} from './social.types';

export class FollowService implements IFollowService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 100;

  constructor(
    private readonly followRepository: IFollowRepository,
    private readonly blockRepository: IBlockRepository,
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly eventPublisher: IEventPublisher
  ) {}

  /**
   * Follow a user.
   *
   * Business Rules:
   * - Cannot follow yourself
   * - Cannot follow if blocked (bidirectional)
   * - Private accounts require approval (pending status)
   * - Public accounts are immediately followed (active status)
   *
   * @param followerId - ID of the user initiating the follow
   * @param followingId - ID of the user to be followed
   * @returns FollowResult with status
   */
  async follow(followerId: string, followingId: string): Promise<FollowResult> {
    // Rule: Cannot follow yourself
    if (followerId === followingId) {
      throw new SelfFollowError();
    }

    // Verify target user exists
    const userExists = await this.userProfileRepository.exists(followingId);
    if (!userExists) {
      throw new UserNotFoundError(followingId);
    }

    // Check block status (bidirectional)
    const isBlocked = await this.blockRepository.isBidirectionallyBlocked(
      followerId,
      followingId
    );
    if (isBlocked) {
      throw new UserBlockedError();
    }

    // Check if already following or pending
    const existingFollow = await this.followRepository.findByPair(
      followerId,
      followingId
    );
    if (existingFollow) {
      return {
        success: true,
        status: 'already_following',
        follow: existingFollow,
      };
    }

    // Get target user's privacy settings
    const targetProfile = await this.userProfileRepository.findByUserId(followingId);
    const requiresApproval = targetProfile?.followApprovalRequired || targetProfile?.isPrivate;

    // Determine follow status based on privacy settings
    const status = requiresApproval ? FollowStatus.PENDING : FollowStatus.ACTIVE;

    // Create the follow relationship
    const follow = await this.followRepository.create({
      followerId,
      followingId,
      status,
    });

    // Publish appropriate event
    const eventType = status === FollowStatus.PENDING ? 'follow.requested' : 'follow.created';
    await this.eventPublisher.publish({
      type: eventType,
      followerId,
      followingId,
      status,
      timestamp: new Date(),
    });

    return {
      success: true,
      status: status === FollowStatus.ACTIVE ? 'followed' : 'pending',
      follow,
    };
  }

  /**
   * Unfollow a user.
   *
   * @param followerId - ID of the user initiating the unfollow
   * @param followingId - ID of the user to be unfollowed
   * @returns UnfollowResult
   */
  async unfollow(followerId: string, followingId: string): Promise<UnfollowResult> {
    // Rule: Cannot unfollow yourself
    if (followerId === followingId) {
      throw new SelfFollowError();
    }

    // Find existing follow relationship
    const existingFollow = await this.followRepository.findByPair(
      followerId,
      followingId
    );
    if (!existingFollow) {
      throw new NotFollowingError();
    }

    // Delete the follow relationship
    await this.followRepository.delete(existingFollow.id);

    // Publish unfollow event
    await this.eventPublisher.publish({
      type: 'follow.removed',
      followerId,
      followingId,
      status: existingFollow.status,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: 'Successfully unfollowed user',
    };
  }

  /**
   * Approve a pending follow request.
   *
   * @param ownerId - ID of the user who owns the account (receiving the request)
   * @param requesterId - ID of the user who sent the follow request
   * @returns ApproveRejectResult
   */
  async approveFollowRequest(
    ownerId: string,
    requesterId: string
  ): Promise<ApproveRejectResult> {
    // Find the pending follow request
    const pendingRequest = await this.followRepository.findByPair(
      requesterId,
      ownerId
    );

    if (!pendingRequest || pendingRequest.status !== FollowStatus.PENDING) {
      throw new FollowRequestNotFoundError();
    }

    // Update status to active
    const updatedFollow = await this.followRepository.updateStatus(
      pendingRequest.id,
      FollowStatus.ACTIVE
    );

    // Publish approval event
    await this.eventPublisher.publish({
      type: 'follow.approved',
      followerId: requesterId,
      followingId: ownerId,
      status: FollowStatus.ACTIVE,
      timestamp: new Date(),
    });

    return {
      success: true,
      follow: updatedFollow,
      message: 'Follow request approved',
    };
  }

  /**
   * Reject a pending follow request.
   *
   * @param ownerId - ID of the user who owns the account (receiving the request)
   * @param requesterId - ID of the user who sent the follow request
   * @returns ApproveRejectResult
   */
  async rejectFollowRequest(
    ownerId: string,
    requesterId: string
  ): Promise<ApproveRejectResult> {
    // Find the pending follow request
    const pendingRequest = await this.followRepository.findByPair(
      requesterId,
      ownerId
    );

    if (!pendingRequest || pendingRequest.status !== FollowStatus.PENDING) {
      throw new FollowRequestNotFoundError();
    }

    // Delete the pending request
    await this.followRepository.delete(pendingRequest.id);

    return {
      success: true,
      message: 'Follow request rejected',
    };
  }

  /**
   * Get paginated list of followers for a user.
   *
   * @param userId - ID of the user to get followers for
   * @param options - Pagination options
   * @returns PaginatedFollowers
   */
  async getFollowers(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedFollowers> {
    const page = options?.page || this.DEFAULT_PAGE;
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const { data: follows, total } = await this.followRepository.findFollowers(
      userId,
      { page, limit }
    );

    // Get profile info for each follower
    const followerInfoPromises = follows.map(async (follow) => {
      const profile = await this.userProfileRepository.findByUserId(follow.followerId);
      return {
        userId: follow.followerId,
        displayName: profile?.displayName || 'Unknown User',
        avatarUrl: profile?.avatarUrl || null,
        followedAt: follow.createdAt,
      } as FollowerInfo;
    });

    const data = await Promise.all(followerInfoPromises);

    const pagination = this.createPagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get paginated list of users that a user is following.
   *
   * @param userId - ID of the user to get following list for
   * @param options - Pagination options
   * @returns PaginatedFollowing
   */
  async getFollowing(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedFollowing> {
    const page = options?.page || this.DEFAULT_PAGE;
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const { data: follows, total } = await this.followRepository.findFollowing(
      userId,
      { page, limit }
    );

    // Get profile info for each followed user
    const followingInfoPromises = follows.map(async (follow) => {
      const profile = await this.userProfileRepository.findByUserId(follow.followingId);
      return {
        userId: follow.followingId,
        displayName: profile?.displayName || 'Unknown User',
        avatarUrl: profile?.avatarUrl || null,
        followedAt: follow.createdAt,
      } as FollowingInfo;
    });

    const data = await Promise.all(followingInfoPromises);

    const pagination = this.createPagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get the relationship status between two users.
   *
   * @param userId - ID of the current user
   * @param targetId - ID of the target user
   * @returns Relationship status
   */
  async getRelationship(userId: string, targetId: string): Promise<Relationship> {
    // Check if blocked
    const isBlocked = await this.blockRepository.isBidirectionallyBlocked(
      userId,
      targetId
    );

    if (isBlocked) {
      return {
        isFollowing: false,
        isFollowedBy: false,
        isBlocked: true,
        followStatus: RelationshipStatus.BLOCKED,
      };
    }

    // Check if user is following target
    const followingRelation = await this.followRepository.findByPair(userId, targetId);

    // Check if target is following user
    const followedByRelation = await this.followRepository.findByPair(targetId, userId);

    const isFollowing = followingRelation?.status === FollowStatus.ACTIVE;
    const isFollowedBy = followedByRelation?.status === FollowStatus.ACTIVE;
    const isPending = followingRelation?.status === FollowStatus.PENDING;

    let followStatus: RelationshipStatus;
    if (isFollowing) {
      followStatus = RelationshipStatus.FOLLOWING;
    } else if (isPending) {
      followStatus = RelationshipStatus.PENDING;
    } else {
      followStatus = RelationshipStatus.NONE;
    }

    return {
      isFollowing,
      isFollowedBy,
      isBlocked: false,
      followStatus,
    };
  }

  /**
   * Get pending follow requests for a user.
   *
   * @param userId - ID of the user to get pending requests for
   * @param options - Pagination options
   * @returns Paginated pending follow requests
   */
  async getPendingRequests(
    userId: string,
    options?: PaginationOptions
  ): Promise<{ data: Follow[]; pagination: Pagination }> {
    const page = options?.page || this.DEFAULT_PAGE;
    const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const { data, total } = await this.followRepository.findPendingRequests(
      userId,
      { page, limit }
    );

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
