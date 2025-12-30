/**
 * Groups & RBAC Type Definitions
 * M5 Groups & Communities - TypeScript Interfaces
 */

// Role hierarchy: Owner (L3) > Moderator (L2) > Member (L1)
export type GroupRole = 'owner' | 'moderator' | 'member';

// Group privacy levels
export type GroupPrivacy = 'public' | 'private' | 'invite_only';

// Group status
export type GroupStatus = 'active' | 'archived' | 'deleted';

// Member status
export type MemberStatus = 'active' | 'muted' | 'banned';

// Membership request status
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Moderation action types
export type ModerationAction =
  | 'member_removed'
  | 'member_banned'
  | 'member_muted'
  | 'post_deleted'
  | 'comment_deleted'
  | 'post_approved'
  | 'post_rejected'
  | 'role_assigned'
  | 'role_revoked';

// Permission types
export type Permission =
  // Member permissions (Level 1)
  | 'create_post'
  | 'edit_own_post'
  | 'delete_own_post'
  | 'create_comment'
  | 'edit_own_comment'
  | 'delete_own_comment'
  | 'leave_group'
  | 'view_group'
  | 'view_members'
  | 'invite_members'
  // Moderator permissions (Level 2)
  | 'remove_member'
  | 'ban_member'
  | 'mute_member'
  | 'delete_post'
  | 'delete_comment'
  | 'approve_post'
  | 'reject_post'
  | 'approve_member'
  | 'reject_request'
  | 'view_reports'
  | 'view_moderation_logs'
  // Owner permissions (Level 3)
  | 'delete_group'
  | 'archive_group'
  | 'update_group'
  | 'transfer_ownership'
  | 'assign_moderator'
  | 'revoke_moderator'
  | 'update_settings';

// Group entity
export interface Group {
  id: string;
  name: string;
  description: string | null;
  privacy: GroupPrivacy;
  status: GroupStatus;
  ownerId: string;
  requirePostApproval: boolean;
  requireMemberApproval: boolean;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  archivedAt: Date | null;
}

// Group member entity
export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  status: MemberStatus;
  mutedUntil: Date | null;
  muteReason: string | null;
  bannedUntil: Date | null;
  banReason: string | null;
  joinedAt: Date;
  updatedAt: Date;
}

// Membership request entity
export interface MembershipRequest {
  id: string;
  groupId: string;
  userId: string;
  status: RequestStatus;
  answers: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// Group invitation entity
export interface GroupInvitation {
  id: string;
  groupId: string;
  inviterId: string;
  inviteeId: string | null;
  inviteeEmail: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

// Moderation log entity
export interface ModerationLog {
  id: string;
  groupId: string;
  moderatorId: string;
  action: ModerationAction;
  targetUserId: string | null;
  targetResourceId: string | null;
  reason: string;
  additionalData: Record<string, unknown> | null;
  createdAt: Date;
}

// DTOs for creating/updating
export interface CreateGroupDTO {
  name: string;
  description?: string;
  privacy: GroupPrivacy;
  requirePostApproval?: boolean;
  requireMemberApproval?: boolean;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  privacy?: GroupPrivacy;
  requirePostApproval?: boolean;
  requireMemberApproval?: boolean;
}

export interface JoinGroupResult {
  success: boolean;
  membership?: GroupMember;
  request?: MembershipRequest;
  message: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  role: GroupRole | null;
  status: MemberStatus | null;
  permissions: Permission[];
  cached: boolean;
  checkedAt: number;
}

// Cache structure for permissions
export interface CachedPermissions {
  role: GroupRole;
  permissions: Permission[];
  status: MemberStatus;
  cachedAt: number;
}

// Authenticated user context
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

// Permission matrix by role
export const PERMISSION_MATRIX: Record<GroupRole, Permission[]> = {
  member: [
    'create_post',
    'edit_own_post',
    'delete_own_post',
    'create_comment',
    'edit_own_comment',
    'delete_own_comment',
    'leave_group',
    'view_group',
    'view_members',
    'invite_members',
  ],
  moderator: [
    // Inherits all member permissions
    'create_post',
    'edit_own_post',
    'delete_own_post',
    'create_comment',
    'edit_own_comment',
    'delete_own_comment',
    'leave_group',
    'view_group',
    'view_members',
    'invite_members',
    // Moderator-specific permissions
    'remove_member',
    'ban_member',
    'mute_member',
    'delete_post',
    'delete_comment',
    'approve_post',
    'reject_post',
    'approve_member',
    'reject_request',
    'view_reports',
    'view_moderation_logs',
  ],
  owner: [
    // Inherits all moderator permissions
    'create_post',
    'edit_own_post',
    'delete_own_post',
    'create_comment',
    'edit_own_comment',
    'delete_own_comment',
    'leave_group',
    'view_group',
    'view_members',
    'invite_members',
    'remove_member',
    'ban_member',
    'mute_member',
    'delete_post',
    'delete_comment',
    'approve_post',
    'reject_post',
    'approve_member',
    'reject_request',
    'view_reports',
    'view_moderation_logs',
    // Owner-specific permissions
    'delete_group',
    'archive_group',
    'update_group',
    'transfer_ownership',
    'assign_moderator',
    'revoke_moderator',
    'update_settings',
  ],
};

// Role level for hierarchy comparison
export const ROLE_LEVEL: Record<GroupRole, number> = {
  member: 1,
  moderator: 2,
  owner: 3,
};
