/**
 * M8 Admin & Security Module - Moderation Service
 *
 * Handles user moderation actions: warn, suspend, ban, unban
 * Implements role-based permission enforcement
 */

import {
  AdminRole,
  ModerationAction,
  ModerationActionType,
  ModerationResult,
  IModerationRepository,
  UserStatus,
} from './admin.types';

/**
 * Permission matrix for moderation actions
 * Based on architecture specification Section 9
 */
const PERMISSION_MATRIX: Record<AdminRole, Record<string, boolean>> = {
  [AdminRole.SUPER_ADMIN]: {
    warn: true,
    suspend: true,
    ban: true,
    unban: true,
    delete: true,
    create_moderator: true,
    create_admin: true,
    system_settings: true,
    view_audit_logs: true,
    export_audit_logs: true,
  },
  [AdminRole.ADMIN]: {
    warn: true,
    suspend: true,
    ban: true,
    unban: true,
    delete: true,
    create_moderator: true,
    create_admin: false,
    system_settings: false,
    view_audit_logs: true,
    export_audit_logs: false,
  },
  [AdminRole.MODERATOR]: {
    warn: true,
    suspend: true,
    ban: false,
    unban: false,
    delete: false,
    create_moderator: false,
    create_admin: false,
    system_settings: false,
    view_audit_logs: false,
    export_audit_logs: false,
  },
  [AdminRole.SUPPORT]: {
    warn: false,
    suspend: false,
    ban: false,
    unban: false,
    delete: false,
    create_moderator: false,
    create_admin: false,
    system_settings: false,
    view_audit_logs: false,
    export_audit_logs: false,
  },
  [AdminRole.AUDITOR]: {
    warn: false,
    suspend: false,
    ban: false,
    unban: false,
    delete: false,
    create_moderator: false,
    create_admin: false,
    system_settings: false,
    view_audit_logs: true,
    export_audit_logs: true,
  },
};

/**
 * User repository interface for moderation operations
 */
interface IUserRepository {
  findById(id: string): Promise<any | null>;
  update(id: string, data: any): Promise<any>;
}

/**
 * Moderation Service for user management actions
 *
 * Features:
 * - Role-based permission checking
 * - Warn, suspend, ban, unban actions
 * - Moderation history tracking
 * - Duration-based suspensions
 */
export class ModerationService {
  private userRepository: IUserRepository;
  private moderationRepository: IModerationRepository;

  constructor(
    userRepository: IUserRepository,
    moderationRepository: IModerationRepository
  ) {
    this.userRepository = userRepository;
    this.moderationRepository = moderationRepository;
  }

  /**
   * Check if a role can perform a specific action
   */
  canPerformAction(role: AdminRole, action: string): boolean {
    const permissions = PERMISSION_MATRIX[role];
    if (!permissions) {
      return false;
    }
    return permissions[action] === true;
  }

  /**
   * Warn a user
   */
  async warnUser(
    targetUserId: string,
    reason: string,
    performedBy: string
  ): Promise<ModerationResult> {
    // Verify target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      return {
        success: false,
        error: 'Target user not found',
      };
    }

    // Create moderation action record
    const action = await this.moderationRepository.create({
      type: ModerationActionType.WARN,
      targetUserId,
      performedBy,
      reason,
    });

    // Update user warning count
    const currentWarnings = targetUser.warningCount || 0;
    await this.userRepository.update(targetUserId, {
      warningCount: currentWarnings + 1,
      lastWarningAt: new Date(),
    });

    return {
      success: true,
      actionId: action.id,
    };
  }

  /**
   * Suspend a user for a specified duration
   */
  async suspendUser(
    targetUserId: string,
    durationDays: number,
    reason: string,
    performedBy: string
  ): Promise<ModerationResult> {
    // Verify target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      return {
        success: false,
        error: 'Target user not found',
      };
    }

    // Check if already suspended or banned
    if (targetUser.status === UserStatus.BANNED) {
      return {
        success: false,
        error: 'User is already banned',
      };
    }

    // Calculate suspension end date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Create moderation action record
    const action = await this.moderationRepository.create({
      type: ModerationActionType.SUSPEND,
      targetUserId,
      performedBy,
      reason,
      durationDays,
      expiresAt,
    });

    // Update user status
    await this.userRepository.update(targetUserId, {
      status: UserStatus.SUSPENDED,
      suspendedUntil: expiresAt,
      suspendedReason: reason,
    });

    return {
      success: true,
      actionId: action.id,
      expiresAt,
    };
  }

  /**
   * Permanently ban a user
   */
  async banUser(
    targetUserId: string,
    reason: string,
    performedBy: string
  ): Promise<ModerationResult> {
    // Verify target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      return {
        success: false,
        error: 'Target user not found',
      };
    }

    // Check if already banned
    if (targetUser.status === UserStatus.BANNED) {
      return {
        success: false,
        error: 'User is already banned',
      };
    }

    // Create moderation action record
    const action = await this.moderationRepository.create({
      type: ModerationActionType.BAN,
      targetUserId,
      performedBy,
      reason,
    });

    // Update user status
    await this.userRepository.update(targetUserId, {
      status: UserStatus.BANNED,
      bannedAt: new Date(),
      bannedReason: reason,
    });

    return {
      success: true,
      actionId: action.id,
    };
  }

  /**
   * Unban a previously banned user
   */
  async unbanUser(
    targetUserId: string,
    reason: string,
    performedBy: string
  ): Promise<ModerationResult> {
    // Verify target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      return {
        success: false,
        error: 'Target user not found',
      };
    }

    // Check if actually banned
    if (targetUser.status !== UserStatus.BANNED) {
      return {
        success: false,
        error: 'User is not banned',
      };
    }

    // Create moderation action record
    const action = await this.moderationRepository.create({
      type: ModerationActionType.UNBAN,
      targetUserId,
      performedBy,
      reason,
    });

    // Update user status
    await this.userRepository.update(targetUserId, {
      status: UserStatus.ACTIVE,
      bannedAt: null,
      bannedReason: null,
    });

    return {
      success: true,
      actionId: action.id,
    };
  }

  /**
   * Get moderation history for a user
   */
  async getModerationHistory(targetUserId: string): Promise<ModerationAction[]> {
    return await this.moderationRepository.findByUserId(targetUserId);
  }

  /**
   * Check if a user is currently suspended and suspension has expired
   */
  async checkAndLiftExpiredSuspension(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.status !== UserStatus.SUSPENDED) {
      return false;
    }

    if (user.suspendedUntil && new Date() >= user.suspendedUntil) {
      // Suspension has expired, lift it
      await this.userRepository.update(userId, {
        status: UserStatus.ACTIVE,
        suspendedUntil: null,
        suspendedReason: null,
      });
      return true;
    }

    return false;
  }

  /**
   * Get remaining suspension time in milliseconds
   */
  async getRemainingSupensionTime(userId: string): Promise<number | null> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.status !== UserStatus.SUSPENDED || !user.suspendedUntil) {
      return null;
    }

    const remaining = user.suspendedUntil.getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}

/**
 * In-memory moderation repository for testing
 */
export class InMemoryModerationRepository implements IModerationRepository {
  private actions: ModerationAction[] = [];
  private idCounter = 1;

  async create(
    action: Omit<ModerationAction, 'id' | 'createdAt'>
  ): Promise<ModerationAction> {
    const newAction: ModerationAction = {
      ...action,
      id: `mod-action-${this.idCounter++}`,
      createdAt: new Date(),
    };
    this.actions.push(newAction);
    return newAction;
  }

  async findByUserId(userId: string): Promise<ModerationAction[]> {
    return this.actions.filter((action) => action.targetUserId === userId);
  }

  async findById(id: string): Promise<ModerationAction | null> {
    return this.actions.find((action) => action.id === id) || null;
  }

  // Test helper methods
  getAllActions(): ModerationAction[] {
    return [...this.actions];
  }

  clear(): void {
    this.actions = [];
    this.idCounter = 1;
  }
}

/**
 * In-memory user repository for testing
 */
export class InMemoryUserRepository {
  private users: Map<string, any> = new Map();

  async findById(id: string): Promise<any | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<any | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async create(user: any): Promise<any> {
    const newUser = {
      ...user,
      id: user.id || `user-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async update(id: string, data: any): Promise<any> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error(`User ${id} not found`);
    }
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Test helper methods
  addUser(user: any): void {
    this.users.set(user.id, user);
  }

  clear(): void {
    this.users.clear();
  }
}
