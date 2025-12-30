/**
 * Membership Service - Group Member Management
 * M5 Groups & RBAC - Join/Leave/Request Workflows
 */

import {
  GroupMember,
  Group,
  MembershipRequest,
  GroupRole,
  MemberStatus,
  ModerationAction,
  AuthenticatedUser,
} from './group.types';

// Repository interfaces
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

export interface GroupRepository {
  findById(id: string): Promise<Group | null>;
  incrementMemberCount(groupId: string): Promise<void>;
  decrementMemberCount(groupId: string): Promise<void>;
}

export interface AuditLogger {
  log(entry: {
    action: ModerationAction;
    groupId: string;
    moderatorId: string;
    targetUserId?: string;
    targetResourceId?: string;
    reason: string;
    additionalData?: Record<string, unknown>;
  }): Promise<void>;
}

export class MembershipService {
  constructor(
    private memberRepository: MemberRepository,
    private requestRepository: RequestRepository,
    private groupRepository: GroupRepository,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Add a member to a group with specified role
   */
  async addMember(
    groupId: string,
    userId: string,
    role: GroupRole = 'member'
  ): Promise<GroupMember> {
    // Check if already a member
    const existingMember = await this.memberRepository.findByGroupAndUser(
      groupId,
      userId
    );

    if (existingMember) {
      throw new Error('User is already a member of this group');
    }

    // Create membership
    const member = await this.memberRepository.create({
      groupId,
      userId,
      role,
      status: 'active',
      joinedAt: new Date(),
      updatedAt: new Date(),
    });

    // Update member count
    await this.groupRepository.incrementMemberCount(groupId);

    return member;
  }

  /**
   * Remove a member from a group
   */
  async removeMember(
    groupId: string,
    targetUserId: string,
    actorUserId: string,
    reason: string
  ): Promise<void> {
    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!member) {
      throw new Error('Member not found');
    }

    // Delete membership
    await this.memberRepository.delete(member.id);

    // Update member count
    await this.groupRepository.decrementMemberCount(groupId);

    // Audit log
    await this.auditLogger.log({
      action: 'member_removed',
      groupId,
      moderatorId: actorUserId,
      targetUserId,
      reason,
    });
  }

  /**
   * Create a membership request for a private group
   */
  async createRequest(
    groupId: string,
    userId: string,
    answers?: Record<string, unknown>
  ): Promise<MembershipRequest> {
    // Check for existing pending request
    const existingRequest = await this.requestRepository.findPendingByGroupAndUser(
      groupId,
      userId
    );

    if (existingRequest) {
      throw new Error('A pending request already exists');
    }

    // Create request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

    return await this.requestRepository.create({
      groupId,
      userId,
      status: 'pending',
      answers: answers || null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      expiresAt,
    });
  }

  /**
   * Approve a membership request
   */
  async approveRequest(
    requestId: string,
    reviewerId: string
  ): Promise<GroupMember> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    // Update request status
    await this.requestRepository.update(requestId, {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });

    // Add member
    const member = await this.addMember(request.groupId, request.userId, 'member');

    // Audit log
    await this.auditLogger.log({
      action: 'role_assigned',
      groupId: request.groupId,
      moderatorId: reviewerId,
      targetUserId: request.userId,
      reason: 'Membership request approved',
    });

    return member;
  }

  /**
   * Reject a membership request
   */
  async rejectRequest(
    requestId: string,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    await this.requestRepository.update(requestId, {
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });
  }

  /**
   * Update member role
   */
  async updateRole(
    groupId: string,
    targetUserId: string,
    newRole: GroupRole,
    actorUserId: string,
    reason: string
  ): Promise<GroupMember> {
    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!member) {
      throw new Error('Member not found');
    }

    const oldRole = member.role;
    const updatedMember = await this.memberRepository.update(member.id, {
      role: newRole,
      updatedAt: new Date(),
    });

    // Audit log
    await this.auditLogger.log({
      action: newRole === 'moderator' ? 'role_assigned' : 'role_revoked',
      groupId,
      moderatorId: actorUserId,
      targetUserId,
      reason,
      additionalData: { oldRole, newRole },
    });

    return updatedMember;
  }

  /**
   * Ban a member
   */
  async banMember(
    groupId: string,
    targetUserId: string,
    actorUserId: string,
    reason: string,
    durationHours?: number
  ): Promise<GroupMember> {
    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!member) {
      throw new Error('Member not found');
    }

    const bannedUntil = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null; // null = permanent

    const updatedMember = await this.memberRepository.update(member.id, {
      status: 'banned',
      banReason: reason,
      bannedUntil,
      updatedAt: new Date(),
    });

    // Audit log
    await this.auditLogger.log({
      action: 'member_banned',
      groupId,
      moderatorId: actorUserId,
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
    actorUserId: string,
    reason: string,
    durationHours: number
  ): Promise<GroupMember> {
    const member = await this.memberRepository.findByGroupAndUser(
      groupId,
      targetUserId
    );

    if (!member) {
      throw new Error('Member not found');
    }

    const mutedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const updatedMember = await this.memberRepository.update(member.id, {
      status: 'muted',
      muteReason: reason,
      mutedUntil,
      updatedAt: new Date(),
    });

    // Audit log
    await this.auditLogger.log({
      action: 'member_muted',
      groupId,
      moderatorId: actorUserId,
      targetUserId,
      reason,
      additionalData: { mutedUntil, durationHours },
    });

    return updatedMember;
  }

  /**
   * Get all members of a group
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return await this.memberRepository.findByGroup(groupId);
  }

  /**
   * Get member count for a group
   */
  async getMemberCount(groupId: string): Promise<number> {
    return await this.memberRepository.countByGroup(groupId);
  }

  /**
   * Check if user is a member of a group
   */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findByGroupAndUser(groupId, userId);
    return member !== null && member.status === 'active';
  }
}
