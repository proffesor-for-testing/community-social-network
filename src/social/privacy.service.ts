/**
 * Privacy Service - Privacy Enforcement Layer
 * M6 Social Graph & Follow System
 *
 * This service enforces privacy rules for profile and content visibility.
 *
 * Privacy Rules:
 * - Public accounts: Anyone can view profile and posts
 * - Private accounts: Only approved followers can view details
 * - Blocked users: No visibility in either direction
 */

import {
  IBlockRepository,
  IFollowRepository,
  IUserProfileRepository,
  IPrivacyService,
  FollowStatus,
} from './social.types';

export class PrivacyService implements IPrivacyService {
  constructor(
    private readonly blockRepository: IBlockRepository,
    private readonly followRepository: IFollowRepository,
    private readonly userProfileRepository: IUserProfileRepository
  ) {}

  /**
   * Check if viewer can view target user's profile.
   *
   * Rules:
   * - Blocked users cannot view each other's profiles
   * - Public profiles are visible to everyone
   * - Private profiles are only visible to approved followers
   * - Users can always view their own profile
   *
   * @param viewerId - ID of the viewing user
   * @param targetId - ID of the target profile
   * @returns true if viewer can view the profile
   */
  async canViewProfile(viewerId: string, targetId: string): Promise<boolean> {
    // Users can always view their own profile
    if (viewerId === targetId) {
      return true;
    }

    // Check block status
    const isBlocked = await this.blockRepository.isBidirectionallyBlocked(
      viewerId,
      targetId
    );
    if (isBlocked) {
      return false;
    }

    // Get target profile privacy settings
    const targetProfile = await this.userProfileRepository.findByUserId(targetId);
    if (!targetProfile) {
      return false; // User doesn't exist
    }

    // Public profiles are visible to everyone
    if (!targetProfile.isPrivate) {
      return true;
    }

    // For private profiles, check if viewer is an approved follower
    const followRelation = await this.followRepository.findByPair(viewerId, targetId);
    return followRelation?.status === FollowStatus.ACTIVE;
  }

  /**
   * Check if viewer can view target user's posts.
   *
   * Rules:
   * - Same as profile visibility for most cases
   * - Blocked users cannot see each other's posts
   * - Private account posts only visible to approved followers
   *
   * @param viewerId - ID of the viewing user
   * @param targetId - ID of the target user whose posts to view
   * @returns true if viewer can view posts
   */
  async canViewPosts(viewerId: string, targetId: string): Promise<boolean> {
    // Same logic as profile visibility for posts
    return this.canViewProfile(viewerId, targetId);
  }

  /**
   * Check if a user can follow another user.
   *
   * Rules:
   * - Cannot follow yourself
   * - Cannot follow if blocked (bidirectional)
   * - Can always follow public accounts
   * - Can request to follow private accounts
   *
   * @param followerId - ID of the user who wants to follow
   * @param targetId - ID of the target user
   * @returns true if the follow action is allowed
   */
  async canFollow(followerId: string, targetId: string): Promise<boolean> {
    // Cannot follow yourself
    if (followerId === targetId) {
      return false;
    }

    // Check block status
    const isBlocked = await this.blockRepository.isBidirectionallyBlocked(
      followerId,
      targetId
    );
    if (isBlocked) {
      return false;
    }

    // Check if target user exists
    const exists = await this.userProfileRepository.exists(targetId);
    return exists;
  }

  /**
   * Check if a user requires follow approval.
   *
   * @param userId - ID of the user to check
   * @returns true if the user has a private account or requires approval
   */
  async requiresFollowApproval(userId: string): Promise<boolean> {
    const profile = await this.userProfileRepository.findByUserId(userId);
    if (!profile) {
      return false;
    }
    return profile.isPrivate || profile.followApprovalRequired;
  }

  /**
   * Check if viewer can see target's follower list.
   *
   * Rules:
   * - Public accounts: Follower list is visible to everyone
   * - Private accounts: Only the owner can see their follower list
   * - Blocked users cannot see each other's lists
   *
   * @param viewerId - ID of the viewing user
   * @param targetId - ID of the target user
   * @returns true if viewer can see the follower list
   */
  async canViewFollowerList(viewerId: string, targetId: string): Promise<boolean> {
    // Users can always view their own lists
    if (viewerId === targetId) {
      return true;
    }

    // Check block status
    const isBlocked = await this.blockRepository.isBidirectionallyBlocked(
      viewerId,
      targetId
    );
    if (isBlocked) {
      return false;
    }

    // Public accounts show follower/following counts to all
    // but detailed lists may be restricted based on privacy settings
    const targetProfile = await this.userProfileRepository.findByUserId(targetId);
    return targetProfile ? !targetProfile.isPrivate : false;
  }

  /**
   * Filter a list of user IDs to only include those visible to the viewer.
   *
   * @param viewerId - ID of the viewing user
   * @param userIds - List of user IDs to filter
   * @returns Filtered list of visible user IDs
   */
  async filterVisibleUsers(viewerId: string, userIds: string[]): Promise<string[]> {
    const visibilityChecks = await Promise.all(
      userIds.map(async (userId) => {
        const canView = await this.canViewProfile(viewerId, userId);
        return { userId, canView };
      })
    );

    return visibilityChecks
      .filter((check) => check.canView)
      .map((check) => check.userId);
  }
}
