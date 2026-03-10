export enum MembershipRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  [MembershipRole.OWNER]: 4,
  [MembershipRole.ADMIN]: 3,
  [MembershipRole.MODERATOR]: 2,
  [MembershipRole.MEMBER]: 1,
};

export function getRoleLevel(role: MembershipRole): number {
  return ROLE_HIERARCHY[role];
}

export function isHigherRole(a: MembershipRole, b: MembershipRole): boolean {
  return ROLE_HIERARCHY[a] > ROLE_HIERARCHY[b];
}

export function isLowerRole(a: MembershipRole, b: MembershipRole): boolean {
  return ROLE_HIERARCHY[a] < ROLE_HIERARCHY[b];
}
