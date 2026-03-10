import { MembershipRole } from './membership-role';

export enum Permission {
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  MANAGE_RULES = 'MANAGE_RULES',
  DELETE_POSTS = 'DELETE_POSTS',
  PIN_POSTS = 'PIN_POSTS',
}

/**
 * Maps each permission to the minimum role required to exercise it.
 * OWNER and ADMIN can manage members and settings.
 * MODERATOR can delete and pin posts and manage rules.
 * MEMBER has no management permissions.
 */
const PERMISSION_ROLE_MAP: Record<Permission, MembershipRole[]> = {
  [Permission.MANAGE_MEMBERS]: [MembershipRole.OWNER, MembershipRole.ADMIN],
  [Permission.MANAGE_SETTINGS]: [MembershipRole.OWNER, MembershipRole.ADMIN],
  [Permission.MANAGE_RULES]: [
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MODERATOR,
  ],
  [Permission.DELETE_POSTS]: [
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MODERATOR,
  ],
  [Permission.PIN_POSTS]: [
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MODERATOR,
  ],
};

export function isPermissionGrantedTo(
  permission: Permission,
  role: MembershipRole,
): boolean {
  return PERMISSION_ROLE_MAP[permission].includes(role);
}
