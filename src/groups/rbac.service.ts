/**
 * RBAC Service - Role-Based Access Control
 * M5 Groups & RBAC - Permission Management
 *
 * Implements 3-tier role hierarchy with caching
 * Target: <10ms for cached permission checks
 */

import {
  GroupRole,
  GroupMember,
  Permission,
  MemberStatus,
  CachedPermissions,
  PermissionCheckResult,
  PERMISSION_MATRIX,
  ROLE_LEVEL,
} from './group.types';

// Repository interface for dependency injection
export interface MemberRepository {
  findByGroupAndUser(groupId: string, userId: string): Promise<GroupMember | null>;
  findByGroup(groupId: string): Promise<GroupMember[]>;
}

// Cache interface for dependency injection
export interface PermissionCache {
  get(key: string): Promise<CachedPermissions | null>;
  set(key: string, value: CachedPermissions, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}

// Permissions that muted members can still use
const MUTED_ALLOWED_PERMISSIONS: Permission[] = [
  'view_group',
  'view_members',
  'leave_group',
];

// Cache TTL in seconds (5 minutes)
const PERMISSION_CACHE_TTL = 300;

export class RBACService {
  private memberRepository: MemberRepository;
  private cache: PermissionCache;

  constructor(memberRepository: MemberRepository, cache: PermissionCache) {
    this.memberRepository = memberRepository;
    this.cache = cache;
  }

  /**
   * Check if a user has a specific permission in a group
   * Uses cache-aside pattern for performance
   */
  async checkPermission(
    userId: string,
    groupId: string,
    permission: Permission
  ): Promise<PermissionCheckResult> {
    const cacheKey = this.getCacheKey(userId, groupId);

    // Step 1: Try cache first (fast path)
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const allowed = this.isPermissionAllowed(permission, cached);
      return {
        allowed,
        role: cached.role,
        status: cached.status,
        permissions: cached.permissions,
        cached: true,
        checkedAt: Date.now(),
      };
    }

    // Step 2: Cache miss - query database
    const membership = await this.memberRepository.findByGroupAndUser(groupId, userId);

    // Non-member
    if (!membership) {
      return {
        allowed: false,
        role: null,
        status: null,
        permissions: [],
        cached: false,
        checkedAt: Date.now(),
      };
    }

    // Step 3: Get permissions for role
    const permissions = PERMISSION_MATRIX[membership.role];

    // Step 4: Cache the result
    const cacheData: CachedPermissions = {
      role: membership.role,
      permissions,
      status: membership.status,
      cachedAt: Date.now(),
    };

    await this.cache.set(cacheKey, cacheData, PERMISSION_CACHE_TTL);

    // Step 5: Check permission with status consideration
    const allowed = this.isPermissionAllowedWithStatus(
      permission,
      permissions,
      membership.status
    );

    return {
      allowed,
      role: membership.role,
      status: membership.status,
      permissions,
      cached: false,
      checkedAt: Date.now(),
    };
  }

  /**
   * Check multiple permissions at once (batch operation)
   */
  async checkPermissions(
    userId: string,
    groupId: string,
    permissions: Permission[]
  ): Promise<Record<Permission, boolean>> {
    const cacheKey = this.getCacheKey(userId, groupId);

    // Try cache first
    let cached = await this.cache.get(cacheKey);

    if (!cached) {
      // Fetch from DB and cache
      const membership = await this.memberRepository.findByGroupAndUser(groupId, userId);

      if (!membership) {
        return permissions.reduce((acc, p) => {
          acc[p] = false;
          return acc;
        }, {} as Record<Permission, boolean>);
      }

      const memberPermissions = PERMISSION_MATRIX[membership.role];
      cached = {
        role: membership.role,
        permissions: memberPermissions,
        status: membership.status,
        cachedAt: Date.now(),
      };

      await this.cache.set(cacheKey, cached, PERMISSION_CACHE_TTL);
    }

    // Check each permission
    return permissions.reduce((acc, p) => {
      acc[p] = this.isPermissionAllowed(p, cached!);
      return acc;
    }, {} as Record<Permission, boolean>);
  }

  /**
   * Check if user can perform action on another member based on role hierarchy
   */
  async canActOnMember(
    actorUserId: string,
    groupId: string,
    targetRole: GroupRole
  ): Promise<boolean> {
    const result = await this.checkPermission(actorUserId, groupId, 'view_group');

    if (!result.role) {
      return false;
    }

    const actorLevel = ROLE_LEVEL[result.role];
    const targetLevel = ROLE_LEVEL[targetRole];

    // Can only act on members with lower role level
    return actorLevel > targetLevel;
  }

  /**
   * Invalidate permission cache for a specific user-group pair
   */
  async invalidatePermissionCache(userId: string, groupId: string): Promise<void> {
    const cacheKey = this.getCacheKey(userId, groupId);
    await this.cache.delete(cacheKey);
  }

  /**
   * Invalidate all permission caches for a group
   */
  async invalidateGroupPermissionCache(groupId: string): Promise<void> {
    await this.cache.deletePattern(`perm:*:${groupId}`);
  }

  /**
   * Get the role of a user in a group
   */
  async getUserRole(userId: string, groupId: string): Promise<GroupRole | null> {
    const result = await this.checkPermission(userId, groupId, 'view_group');
    return result.role;
  }

  /**
   * Check if a user is an owner of a group
   */
  async isOwner(userId: string, groupId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, groupId);
    return role === 'owner';
  }

  /**
   * Check if a user is at least a moderator
   */
  async isModeratorOrAbove(userId: string, groupId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, groupId);
    return role === 'owner' || role === 'moderator';
  }

  // Private helper methods

  private getCacheKey(userId: string, groupId: string): string {
    return `perm:${userId}:${groupId}`;
  }

  private isPermissionAllowed(
    permission: Permission,
    cached: CachedPermissions
  ): boolean {
    return this.isPermissionAllowedWithStatus(
      permission,
      cached.permissions,
      cached.status
    );
  }

  private isPermissionAllowedWithStatus(
    permission: Permission,
    permissions: Permission[],
    status: MemberStatus
  ): boolean {
    // Banned members have no permissions
    if (status === 'banned') {
      return false;
    }

    // Muted members can only use certain permissions
    if (status === 'muted') {
      return MUTED_ALLOWED_PERMISSIONS.includes(permission);
    }

    // Active members use normal permission check
    return permissions.includes(permission);
  }
}
