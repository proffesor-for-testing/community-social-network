/**
 * Group Service - Core Group Operations
 * M5 Groups & RBAC - Business Logic Layer
 *
 * Implements group creation, joining, and management workflows
 */

import {
  Group,
  GroupMember,
  CreateGroupDTO,
  UpdateGroupDTO,
  JoinGroupResult,
  MembershipRequest,
  GroupRole,
  ModerationAction,
  AuthenticatedUser,
  ROLE_LEVEL,
} from './group.types';
import { RBACService } from './rbac.service';
import { MembershipService, AuditLogger } from './membership.service';

// Repository interfaces
export interface GroupRepository {
  create(data: Partial<Group>): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  findByName(name: string): Promise<Group | null>;
  update(id: string, data: Partial<Group>): Promise<Group>;
  delete(id: string): Promise<void>;
  list(options?: { privacy?: string; page?: number; limit?: number }): Promise<Group[]>;
  incrementMemberCount(groupId: string): Promise<void>;
  decrementMemberCount(groupId: string): Promise<void>;
}

export interface MemberRepository {
  create(data: Partial<GroupMember>): Promise<GroupMember>;
  findByGroupAndUser(groupId: string, userId: string): Promise<GroupMember | null>;
  findByGroup(groupId: string): Promise<GroupMember[]>;
  findByUser(userId: string): Promise<GroupMember[]>;
  update(id: string, data: Partial<GroupMember>): Promise<GroupMember>;
  delete(id: string): Promise<void>;
  countByGroup(groupId: string): Promise<number>;
}

export interface RequestRepository {
  create(data: Partial<MembershipRequest>): Promise<MembershipRequest>;
  findById(id: string): Promise<MembershipRequest | null>;
  findPendingByGroupAndUser(groupId: string, userId: string): Promise<MembershipRequest | null>;
  update(id: string, data: Partial<MembershipRequest>): Promise<MembershipRequest>;
  delete(id: string): Promise<void>;
}

export interface PermissionCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}

export class GroupService {
  constructor(
    private groupRepository: GroupRepository,
    private memberRepository: MemberRepository,
    private rbacService: RBACService,
    private membershipService: MembershipService,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Create a new group
   * Creator is automatically assigned as owner
   */
  async createGroup(
    dto: CreateGroupDTO,
    user: AuthenticatedUser
  ): Promise<Group> {
    // Check if group name already exists
    const existingGroup = await this.groupRepository.findByName(dto.name);
    if (existingGroup) {
      throw new Error('Group name already exists');
    }

    // Create the group
    const group = await this.groupRepository.create({
      name: dto.name,
      description: dto.description || null,
      privacy: dto.privacy,
      status: 'active',
      ownerId: user.id,
      requirePostApproval: dto.requirePostApproval || false,
      requireMemberApproval: dto.requireMemberApproval || false,
      memberCount: 1, // Creator is the first member
      postCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      archivedAt: null,
    });

    // Add creator as owner
    await this.memberRepository.create({
      groupId: group.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
      mutedUntil: null,
      muteReason: null,
      bannedUntil: null,
      banReason: null,
      joinedAt: new Date(),
      updatedAt: new Date(),
    });

    return group;
  }

  /**
   * Join a group
   * Public groups: immediate join
   * Private groups: creates pending request
   */
  async joinGroup(
    groupId: string,
    user: AuthenticatedUser
  ): Promise<JoinGroupResult> {
    // Get the group
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.status !== 'active') {
      throw new Error('Cannot join an inactive group');
    }

    // Check if already a member
    const existingMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      user.id
    );
    if (existingMember) {
      throw new Error('Already a member of this group');
    }

    // Public group without approval requirement: immediate join
    if (group.privacy === 'public' && !group.requireMemberApproval) {
      const membership = await this.memberRepository.create({
        groupId,
        userId: user.id,
        role: 'member',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      await this.groupRepository.incrementMemberCount(groupId);

      return {
        success: true,
        membership,
        message: 'Successfully joined the group',
      };
    }

    // Private group or requires approval: create pending request
    const request = await this.membershipService.createRequest(groupId, user.id);

    return {
      success: true,
      request,
      message: 'Membership request is pending approval',
    };
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string, user: AuthenticatedUser): Promise<void> {
    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      user.id
    );

    if (!member) {
      throw new Error('Not a member of this group');
    }

    if (member.role === 'owner') {
      throw new Error('Owner cannot leave the group. Transfer ownership first.');
    }

    await this.memberRepository.delete(member.id);
    await this.groupRepository.decrementMemberCount(groupId);
  }

  /**
   * Assign a role to a member (owner only)
   */
  async assignRole(
    groupId: string,
    targetUserId: string,
    newRole: GroupRole,
    actor: AuthenticatedUser
  ): Promise<GroupMember> {
    // Cannot assign owner role directly
    if (newRole === 'owner') {
      throw new Error('Cannot assign owner role directly. Use transfer ownership.');
    }

    // Get actor's membership
    const actorMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      actor.id
    );

    if (!actorMember || actorMember.role !== 'owner') {
      throw new Error('Only owner can assign roles');
    }

    // Get target's membership
    const targetMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!targetMember) {
      throw new Error('Target user is not a member of this group');
    }

    // Update role
    const updatedMember = await this.memberRepository.update(targetMember.id, {
      role: newRole,
      updatedAt: new Date(),
    });

    // Invalidate permission cache
    await this.rbacService.invalidatePermissionCache(targetUserId, groupId);

    // Audit log
    await this.auditLogger.log({
      action: 'role_assigned',
      groupId,
      moderatorId: actor.id,
      targetUserId,
      reason: `Role changed to ${newRole}`,
    });

    return updatedMember;
  }

  /**
   * Revoke moderator role (owner only)
   */
  async revokeModeratorRole(
    groupId: string,
    targetUserId: string,
    actor: AuthenticatedUser
  ): Promise<GroupMember> {
    return this.assignRole(groupId, targetUserId, 'member', actor);
  }

  /**
   * Ban a member from the group
   */
  async banMember(
    groupId: string,
    targetUserId: string,
    reason: string,
    actor: AuthenticatedUser,
    durationHours?: number
  ): Promise<GroupMember> {
    // Get actor's membership
    const actorMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      actor.id
    );

    if (!actorMember) {
      throw new Error('You are not a member of this group');
    }

    // Check if actor has ban permission
    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'ban_member'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to ban members');
    }

    // Get target's membership
    const targetMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!targetMember) {
      throw new Error('Target user is not a member of this group');
    }

    // Cannot ban moderator or owner (unless you're the owner)
    if (
      (targetMember.role === 'moderator' || targetMember.role === 'owner') &&
      actorMember.role !== 'owner'
    ) {
      throw new Error('Cannot ban a moderator or owner');
    }

    // Cannot ban the owner at all
    if (targetMember.role === 'owner') {
      throw new Error('Cannot ban the group owner');
    }

    const bannedUntil = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    // Update member status
    const updatedMember = await this.memberRepository.update(targetMember.id, {
      status: 'banned',
      banReason: reason,
      bannedUntil,
      updatedAt: new Date(),
    });

    // Invalidate permission cache
    await this.rbacService.invalidatePermissionCache(targetUserId, groupId);

    // Audit log
    await this.auditLogger.log({
      action: 'member_banned',
      groupId,
      moderatorId: actor.id,
      targetUserId,
      reason,
      additionalData: { bannedUntil, permanent: !durationHours },
    });

    return updatedMember;
  }

  /**
   * Mute a member
   */
  async muteMember(
    groupId: string,
    targetUserId: string,
    reason: string,
    actor: AuthenticatedUser,
    durationHours: number
  ): Promise<GroupMember> {
    // Similar to ban but sets muted status
    const actorMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      actor.id
    );

    if (!actorMember) {
      throw new Error('You are not a member of this group');
    }

    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'mute_member'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to mute members');
    }

    const targetMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!targetMember) {
      throw new Error('Target user is not a member of this group');
    }

    // Cannot mute moderator or owner (unless you're the owner)
    const actorLevel = ROLE_LEVEL[actorMember.role];
    const targetLevel = ROLE_LEVEL[targetMember.role];

    if (targetLevel >= actorLevel) {
      throw new Error('Cannot mute a member of equal or higher role');
    }

    const mutedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const updatedMember = await this.memberRepository.update(targetMember.id, {
      status: 'muted',
      muteReason: reason,
      mutedUntil,
      updatedAt: new Date(),
    });

    await this.rbacService.invalidatePermissionCache(targetUserId, groupId);

    await this.auditLogger.log({
      action: 'member_muted',
      groupId,
      moderatorId: actor.id,
      targetUserId,
      reason,
      additionalData: { mutedUntil, durationHours },
    });

    return updatedMember;
  }

  /**
   * Check if user can access group content
   */
  async canAccessGroupContent(
    groupId: string,
    user: AuthenticatedUser | null
  ): Promise<boolean> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      return false;
    }

    // Public groups: anyone can view
    if (group.privacy === 'public') {
      return true;
    }

    // Private/Invite-only: must be a member
    if (!user) {
      return false;
    }

    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      user.id
    );

    return member !== null && member.status === 'active';
  }

  /**
   * Update group settings (owner only)
   */
  async updateGroup(
    groupId: string,
    dto: UpdateGroupDTO,
    actor: AuthenticatedUser
  ): Promise<Group> {
    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'update_group'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to update this group');
    }

    // Check name uniqueness if changing
    if (dto.name) {
      const existingGroup = await this.groupRepository.findByName(dto.name);
      if (existingGroup && existingGroup.id !== groupId) {
        throw new Error('Group name already exists');
      }
    }

    return await this.groupRepository.update(groupId, {
      ...dto,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete a group (owner only)
   */
  async deleteGroup(groupId: string, actor: AuthenticatedUser): Promise<void> {
    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'delete_group'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to delete this group');
    }

    await this.groupRepository.update(groupId, {
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
    });

    // Invalidate all permission caches for this group
    await this.rbacService.invalidateGroupPermissionCache(groupId);
  }

  /**
   * Archive a group (owner only)
   */
  async archiveGroup(groupId: string, actor: AuthenticatedUser): Promise<Group> {
    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'archive_group'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to archive this group');
    }

    return await this.groupRepository.update(groupId, {
      status: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Get group by ID
   */
  async getGroup(groupId: string): Promise<Group | null> {
    return await this.groupRepository.findById(groupId);
  }

  /**
   * List groups
   */
  async listGroups(options?: {
    privacy?: string;
    page?: number;
    limit?: number;
  }): Promise<Group[]> {
    return await this.groupRepository.list(options);
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return await this.memberRepository.findByGroup(groupId);
  }

  /**
   * Transfer ownership to another member
   */
  async transferOwnership(
    groupId: string,
    newOwnerId: string,
    actor: AuthenticatedUser
  ): Promise<void> {
    const hasPermission = await this.rbacService.checkPermission(
      actor.id,
      groupId,
      'transfer_ownership'
    );

    if (!hasPermission.allowed) {
      throw new Error('You do not have permission to transfer ownership');
    }

    // Get new owner's membership
    const newOwnerMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      newOwnerId
    );

    if (!newOwnerMember) {
      throw new Error('New owner must be a member of the group');
    }

    // Get current owner's membership
    const currentOwnerMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      actor.id
    );

    if (!currentOwnerMember) {
      throw new Error('Current owner membership not found');
    }

    // Update new owner to owner role
    await this.memberRepository.update(newOwnerMember.id, {
      role: 'owner',
      updatedAt: new Date(),
    });

    // Demote current owner to moderator
    await this.memberRepository.update(currentOwnerMember.id, {
      role: 'moderator',
      updatedAt: new Date(),
    });

    // Update group owner_id
    await this.groupRepository.update(groupId, {
      ownerId: newOwnerId,
      updatedAt: new Date(),
    });

    // Invalidate permission caches
    await this.rbacService.invalidatePermissionCache(actor.id, groupId);
    await this.rbacService.invalidatePermissionCache(newOwnerId, groupId);

    // Audit log
    await this.auditLogger.log({
      action: 'role_assigned',
      groupId,
      moderatorId: actor.id,
      targetUserId: newOwnerId,
      reason: 'Ownership transferred',
      additionalData: { previousOwner: actor.id },
    });
  }
}
