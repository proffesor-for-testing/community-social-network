/**
 * M8 Admin & Security Module - TypeScript Type Definitions
 *
 * Defines all interfaces, types, and enums for the admin security system
 * following the architecture specification.
 */

/**
 * Admin role hierarchy
 * Super Admin > Admin > Moderator > Support > Auditor
 */
export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  SUPPORT = 'support',
  AUDITOR = 'auditor',
}

/**
 * User/Admin account status
 */
export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  DELETED = 'deleted',
}

/**
 * Audit log status
 */
export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  BLOCKED = 'blocked',
}

/**
 * Security alert severity levels
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Moderation action types
 */
export enum ModerationActionType {
  WARN = 'warn',
  SUSPEND = 'suspend',
  BAN = 'ban',
  UNBAN = 'unban',
  DELETE = 'delete',
}

/**
 * Admin user entity
 */
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus | string;
  role: AdminRole;
  require2FA: boolean;
  requireIpWhitelist: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Two-factor authentication record
 */
export interface Admin2FA {
  id: string;
  userId: string;
  secret: string; // AES-256 encrypted
  backupCodes: string[]; // bcrypt hashed
  enabled: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin session record
 */
export interface AdminSession {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

/**
 * IP whitelist entry
 */
export interface IpWhitelistEntry {
  id: string;
  userId: string;
  ipAddress: string | null;
  ipRangeStart: string | null;
  ipRangeEnd: string | null;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Admin role definition
 */
export interface AdminRoleDefinition {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin permission record
 */
export interface AdminPermission {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  conditions: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id?: number;
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  changes?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  status: AuditStatus | string;
  errorMessage?: string;
  sessionId?: string;
  details?: Record<string, any>;
  createdAt?: Date;
}

/**
 * Security alert record
 */
export interface SecurityAlert {
  id: string;
  userId: string | null;
  alertType: string;
  severity: AlertSeverity;
  description: string;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

/**
 * Moderation action record
 */
export interface ModerationAction {
  id: string;
  type: ModerationActionType;
  targetUserId: string;
  performedBy: string;
  reason: string;
  durationDays?: number;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * TOTP setup result
 */
export interface TotpSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Login initiation result
 */
export interface LoginInitResult {
  requires2FA: boolean;
  tempToken?: string;
  sessionToken?: string;
  expiresAt?: Date;
}

/**
 * Login completion result
 */
export interface LoginCompleteResult {
  success: boolean;
  sessionToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * 2FA verification result
 */
export interface TwoFactorVerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Moderation action result
 */
export interface ModerationResult {
  success: boolean;
  actionId?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Permission check result for a role
 */
export interface RolePermissions {
  canWarnUser: boolean;
  canSuspendUser: boolean;
  canBanUser: boolean;
  canDeleteUser: boolean;
  canCreateModerator: boolean;
  canCreateAdmin: boolean;
  canAccessSystemSettings: boolean;
  canViewAuditLogs: boolean;
  canExportAuditLogs: boolean;
  canManageIpWhitelist: boolean;
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Repository interface for admin users
 */
export interface IAdminUserRepository {
  findById(id: string): Promise<AdminUser | null>;
  findByEmail(email: string): Promise<AdminUser | null>;
  create(user: Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminUser>;
  update(id: string, data: Partial<AdminUser>): Promise<AdminUser>;
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for 2FA records
 */
export interface IAdmin2FARepository {
  findByUserId(userId: string): Promise<Admin2FA | null>;
  create(data: Omit<Admin2FA, 'id' | 'createdAt' | 'updatedAt'>): Promise<Admin2FA>;
  update(userId: string, data: Partial<Admin2FA>): Promise<Admin2FA>;
  delete(userId: string): Promise<void>;
}

/**
 * Repository interface for audit logs
 */
export interface IAuditLogRepository {
  create(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<AuditLogEntry[]>;
  findByAction(actionPattern: string, options?: PaginationOptions): Promise<AuditLogEntry[]>;
  findByTimeRange(
    startDate: Date,
    endDate: Date,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]>;
}

/**
 * Repository interface for moderation actions
 */
export interface IModerationRepository {
  create(action: Omit<ModerationAction, 'id' | 'createdAt'>): Promise<ModerationAction>;
  findByUserId(userId: string): Promise<ModerationAction[]>;
  findById(id: string): Promise<ModerationAction | null>;
}

/**
 * TOTP configuration
 */
export interface TotpConfig {
  algorithm: 'sha1' | 'sha256' | 'sha512';
  digits: number;
  step: number;
  window: number;
  encoding: 'base32' | 'hex';
  secretLength: number;
  issuer: string;
}

/**
 * Default TOTP configuration as per architecture spec
 */
export const DEFAULT_TOTP_CONFIG: TotpConfig = {
  algorithm: 'sha1',
  digits: 6,
  step: 30,
  window: 1, // +/- 1 window (90s total)
  encoding: 'base32',
  secretLength: 32, // 256-bit secret
  issuer: 'CommunityNetwork',
};

/**
 * Session configuration
 */
export interface SessionConfig {
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
  rotationIntervalMinutes: number;
  singleSessionEnforcement: boolean;
}

/**
 * Default session configuration as per architecture spec
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  idleTimeoutMinutes: 120, // 2 hours
  absoluteTimeoutHours: 8,
  rotationIntervalMinutes: 15,
  singleSessionEnforcement: true,
};

/**
 * Re-authentication token payload
 */
export interface ReauthTokenPayload {
  sub: string; // admin user id
  iat: number;
  exp: number;
  type: 'reauth';
  action: string;
  singleUse: boolean;
}

/**
 * Sensitive actions requiring re-authentication
 */
export const SENSITIVE_ACTIONS = [
  'admin.user.delete',
  'admin.permissions.modify',
  'admin.system.config',
  'admin.audit.export',
  'admin.2fa.reset',
  'admin.ip_whitelist.modify',
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

/**
 * Admin action audit categories
 */
export const AUDIT_CATEGORIES = {
  AUTHENTICATION: [
    'auth.login.success',
    'auth.login.failure',
    'auth.login.initiated',
    'auth.logout',
    'auth.2fa.enabled',
    'auth.2fa.disabled',
    'auth.2fa.verification.failure',
    'auth.session.expired',
    'auth.session.rotated',
  ],
  AUTHORIZATION: [
    'authz.permission.denied',
    'authz.role.assigned',
    'authz.role.removed',
  ],
  MODERATION: [
    'moderation.user.warn',
    'moderation.user.suspend',
    'moderation.user.ban',
    'moderation.user.unban',
    'moderation.user.delete',
    'moderation.content.remove',
    'moderation.content.approve',
  ],
  SYSTEM: [
    'system.config.updated',
    'system.feature.toggled',
    'system.backup.created',
  ],
  SECURITY: [
    'security.ip_whitelist.added',
    'security.ip_whitelist.removed',
    'security.ip_denied',
    'security.brute_force.detected',
    'security.session.hijack.detected',
  ],
} as const;
