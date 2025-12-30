/**
 * Authentication Types and Interfaces
 * M1 Authentication Module - Type Definitions
 */

// ============================================================================
// Request Types
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface RegisterResponse {
  success: boolean;
  userId: number;
  email: string;
  message: string;
}

export interface LoginResponse {
  success: boolean;
  tokens: AuthTokens;
  user: UserPublic;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  expiresIn: number;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export interface LogoutResponse {
  success: boolean;
}

// ============================================================================
// Token Types
// ============================================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenPayload {
  userId: number;
  email: string;
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshToken {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiry: Date | null;
  accountLocked: boolean;
  lockoutExpiry: Date | null;
  failedLoginAttempts: number;
  lastFailedLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  id: number;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export interface AccountLockoutResult {
  locked: boolean;
  lockedUntil?: Date;
}

export interface FailedAttemptResult {
  attempts: number;
  shouldLock: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export enum AuthErrorCode {
  // Registration errors
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  PASSWORD_WEAK = 'PASSWORD_WEAK',
  INVALID_EMAIL = 'INVALID_EMAIL',

  // Login errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Token errors
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Password reset errors
  INVALID_RESET_TOKEN = 'INVALID_RESET_TOKEN',
  RESET_TOKEN_EXPIRED = 'RESET_TOKEN_EXPIRED',

  // Email verification errors
  INVALID_VERIFICATION_TOKEN = 'INVALID_VERIFICATION_TOKEN',
  VERIFICATION_TOKEN_EXPIRED = 'VERIFICATION_TOKEN_EXPIRED',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;
  public readonly retryAfter?: number;
  public readonly lockedUntil?: Date;

  constructor(
    code: AuthErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      retryAfter?: number;
      lockedUntil?: Date;
    }
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = options?.statusCode ?? AuthError.getStatusCode(code);
    this.retryAfter = options?.retryAfter;
    this.lockedUntil = options?.lockedUntil;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AuthError);
  }

  private static getStatusCode(code: AuthErrorCode): number {
    switch (code) {
      case AuthErrorCode.EMAIL_EXISTS:
      case AuthErrorCode.PASSWORD_WEAK:
      case AuthErrorCode.INVALID_EMAIL:
      case AuthErrorCode.VALIDATION_ERROR:
        return 400;

      case AuthErrorCode.INVALID_CREDENTIALS:
      case AuthErrorCode.INVALID_ACCESS_TOKEN:
      case AuthErrorCode.INVALID_REFRESH_TOKEN:
      case AuthErrorCode.TOKEN_EXPIRED:
      case AuthErrorCode.INVALID_RESET_TOKEN:
      case AuthErrorCode.RESET_TOKEN_EXPIRED:
      case AuthErrorCode.INVALID_VERIFICATION_TOKEN:
      case AuthErrorCode.VERIFICATION_TOKEN_EXPIRED:
        return 401;

      case AuthErrorCode.EMAIL_NOT_VERIFIED:
        return 403;

      case AuthErrorCode.ACCOUNT_LOCKED:
        return 423;

      case AuthErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;

      case AuthErrorCode.INTERNAL_ERROR:
      default:
        return 500;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: this.code,
      message: this.message,
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
      ...(this.lockedUntil && { lockedUntil: this.lockedUntil.toISOString() }),
    };
  }
}

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  findByVerificationToken(tokenHash: string): Promise<User | null>;
  findByPasswordResetToken(tokenHash: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: number, data: Partial<User>): Promise<User>;
  incrementFailedAttempts(id: number): Promise<void>;
  resetFailedAttempts(id: number): Promise<void>;
  setAccountLocked(id: number, lockedUntil: Date): Promise<void>;
  savePasswordResetToken(id: number, tokenHash: string, expiry: Date): Promise<void>;
  clearPasswordResetToken(id: number): Promise<void>;
  updatePassword(id: number, passwordHash: string): Promise<void>;
  setEmailVerified(id: number): Promise<void>;
}

export interface TokenRepository {
  saveRefreshToken(token: Omit<RefreshToken, 'id'>): Promise<RefreshToken>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: number): Promise<void>;
  updateLastUsed(id: number): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
}

// ============================================================================
// Service Dependencies
// ============================================================================

export interface AuthServiceDependencies {
  userRepository: UserRepository;
  tokenRepository: TokenRepository;
  tokenManager: import('./token.manager').TokenManager;
  rateLimiter: import('./rate.limiter').RateLimiter;
  passwordHasher: import('./password.hasher').PasswordHasher;
  emailService: import('./email.service').EmailService;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AuthConfig {
  bcryptRounds: number;
  accessTokenExpiry: number; // seconds
  refreshTokenExpiry: number; // seconds
  passwordResetExpiry: number; // seconds
  emailVerificationExpiry: number; // seconds
  maxFailedAttempts: number;
  lockoutDuration: number; // seconds
  rateLimits: {
    registration: { limit: number; window: number };
    login: { limit: number; window: number };
    passwordReset: { limit: number; window: number };
  };
}

export const defaultAuthConfig: AuthConfig = {
  bcryptRounds: 12,
  accessTokenExpiry: 900, // 15 minutes
  refreshTokenExpiry: 604800, // 7 days
  passwordResetExpiry: 3600, // 1 hour
  emailVerificationExpiry: 86400, // 24 hours
  maxFailedAttempts: 5,
  lockoutDuration: 1800, // 30 minutes
  rateLimits: {
    registration: { limit: 5, window: 3600 },
    login: { limit: 10, window: 900 },
    passwordReset: { limit: 3, window: 3600 },
  },
};
