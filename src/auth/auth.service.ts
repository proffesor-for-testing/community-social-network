/**
 * Authentication Service
 * Core authentication business logic implementing TDD London School patterns
 */

import {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  LogoutRequest,
  RegisterResponse,
  LoginResponse,
  RefreshTokenResponse,
  PasswordResetResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
  LogoutResponse,
  User,
  UserPublic,
  AuthTokens,
  AuthError,
  AuthErrorCode,
  AuthServiceDependencies,
  UserRepository,
  TokenRepository,
  defaultAuthConfig,
  AuthConfig,
} from './auth.types';
import { TokenManager } from './token.manager';
import { RateLimiter } from './rate.limiter';
import { PasswordHasher } from './password.hasher';
import { EmailService } from './email.service';
import { validatePasswordStrength, normalizeEmail } from './auth.validation';

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly tokenRepository: TokenRepository;
  private readonly tokenManager: TokenManager;
  private readonly rateLimiter: RateLimiter;
  private readonly passwordHasher: PasswordHasher;
  private readonly emailService: EmailService;
  private readonly config: AuthConfig;

  constructor(
    dependencies: AuthServiceDependencies,
    config: Partial<AuthConfig> = {}
  ) {
    this.userRepository = dependencies.userRepository;
    this.tokenRepository = dependencies.tokenRepository;
    this.tokenManager = dependencies.tokenManager;
    this.rateLimiter = dependencies.rateLimiter;
    this.passwordHasher = dependencies.passwordHasher;
    this.emailService = dependencies.emailService;
    this.config = { ...defaultAuthConfig, ...config };
  }

  /**
   * Register a new user account
   *
   * Flow:
   * 1. Check rate limit
   * 2. Validate password strength
   * 3. Check if email already exists
   * 4. Hash password
   * 5. Generate verification token
   * 6. Create user
   * 7. Send verification email
   *
   * @param request - Registration request with email and password
   * @returns RegisterResponse with user info
   * @throws AuthError on validation failure or duplicate email
   */
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const email = normalizeEmail(request.email);

    // Step 1: Check rate limit
    const rateLimitResult = await this.rateLimiter.checkLimit('registration', email);
    if (!rateLimitResult.allowed) {
      throw new AuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many registration attempts. Please try again later.',
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Step 2: Validate password strength
    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_WEAK,
        passwordValidation.errors.join(' ')
      );
    }

    // Step 3: Check if email already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new AuthError(
        AuthErrorCode.EMAIL_EXISTS,
        'An account with this email already exists.'
      );
    }

    // Step 4: Hash password (bcrypt with 12 rounds)
    const passwordHash = await this.passwordHasher.hash(request.password);

    // Step 5: Generate verification token
    const verificationToken = this.tokenManager.generateRefreshToken();
    const verificationTokenHash = this.tokenManager.hashToken(verificationToken);
    const verificationExpiry = new Date(
      Date.now() + this.config.emailVerificationExpiry * 1000
    );

    // Step 6: Create user
    const user = await this.userRepository.create({
      email,
      passwordHash,
      emailVerificationToken: verificationTokenHash,
      emailVerificationExpiry: verificationExpiry,
    });

    // Step 7: Send verification email (async, non-blocking)
    try {
      await this.emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
    }

    return {
      success: true,
      userId: user.id,
      email: user.email,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Authenticate user and return tokens
   *
   * Flow:
   * 1. Check rate limit (by IP)
   * 2. Check account lockout
   * 3. Find user by email
   * 4. Verify password
   * 5. Check email verification
   * 6. Generate tokens
   * 7. Save refresh token
   * 8. Reset failed attempts
   *
   * @param request - Login request with email and password
   * @param ipAddress - Client IP address for rate limiting
   * @param userAgent - Client user agent for token tracking
   * @returns LoginResponse with tokens and user info
   * @throws AuthError on authentication failure
   */
  async login(
    request: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResponse> {
    const email = normalizeEmail(request.email);

    // Step 1: Check rate limit by IP
    const rateLimitResult = await this.rateLimiter.checkLimit('login', ipAddress);
    if (!rateLimitResult.allowed) {
      throw new AuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many login attempts. Please try again later.',
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Step 2: Check account lockout (need user ID first, so we do a pre-check)
    // We'll do this after finding the user

    // Step 3: Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AuthError(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password.'
      );
    }

    // Step 2 (continued): Check account lockout
    const lockoutResult = await this.rateLimiter.checkAccountLockout(user.id);
    if (lockoutResult.locked) {
      throw new AuthError(
        AuthErrorCode.ACCOUNT_LOCKED,
        'Account is temporarily locked due to too many failed login attempts.',
        { lockedUntil: lockoutResult.lockedUntil }
      );
    }

    // Step 4: Verify password
    const isPasswordValid = await this.passwordHasher.verify(
      request.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      // Track failed attempt
      const failedResult = await this.rateLimiter.incrementFailedAttempt(user.id);

      if (failedResult.shouldLock) {
        await this.rateLimiter.setAccountLockout(user.id, this.config.lockoutDuration);
        await this.userRepository.setAccountLocked(
          user.id,
          new Date(Date.now() + this.config.lockoutDuration * 1000)
        );
      }

      throw new AuthError(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password.'
      );
    }

    // Step 5: Check email verification
    if (!user.emailVerified) {
      throw new AuthError(
        AuthErrorCode.EMAIL_NOT_VERIFIED,
        'Please verify your email address before logging in.'
      );
    }

    // Step 6: Generate tokens
    const accessToken = this.tokenManager.generateAccessToken({
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    const refreshToken = this.tokenManager.generateRefreshToken();
    const refreshTokenHash = this.tokenManager.hashToken(refreshToken);
    const refreshTokenExpiry = new Date(
      Date.now() + this.config.refreshTokenExpiry * 1000
    );

    // Step 7: Save refresh token
    await this.tokenRepository.saveRefreshToken({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiry,
      isRevoked: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      ipAddress,
      userAgent,
    });

    // Step 8: Reset failed attempts
    await this.rateLimiter.resetFailedAttempts(user.id);
    await this.userRepository.resetFailedAttempts(user.id);

    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenExpiry,
    };

    return {
      success: true,
      tokens,
      user: this.toPublicUser(user),
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * Flow:
   * 1. Hash refresh token
   * 2. Find token in database
   * 3. Validate token (not expired, not revoked)
   * 4. Get user
   * 5. Generate new access token
   * 6. Update last used timestamp
   *
   * @param request - Refresh token request
   * @returns RefreshTokenResponse with new access token
   * @throws AuthError if token is invalid
   */
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    // Step 1: Hash refresh token
    const tokenHash = this.tokenManager.hashToken(request.refreshToken);

    // Step 2: Find token in database
    const storedToken = await this.tokenRepository.findRefreshToken(tokenHash);
    if (!storedToken) {
      throw new AuthError(
        AuthErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token.'
      );
    }

    // Step 3: Validate token
    if (storedToken.isRevoked) {
      throw new AuthError(
        AuthErrorCode.INVALID_REFRESH_TOKEN,
        'Refresh token has been revoked.'
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AuthError(
        AuthErrorCode.INVALID_REFRESH_TOKEN,
        'Refresh token has expired.'
      );
    }

    // Step 4: Get user
    const user = await this.userRepository.findById(storedToken.userId);
    if (!user) {
      throw new AuthError(
        AuthErrorCode.INVALID_REFRESH_TOKEN,
        'User not found.'
      );
    }

    // Step 5: Generate new access token
    const accessToken = this.tokenManager.generateAccessToken({
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    // Step 6: Update last used timestamp
    await this.tokenRepository.updateLastUsed(storedToken.id);

    return {
      success: true,
      accessToken,
      expiresIn: this.config.accessTokenExpiry,
    };
  }

  /**
   * Request password reset
   *
   * Flow:
   * 1. Check rate limit
   * 2. Find user by email
   * 3. Generate reset token (if user exists)
   * 4. Save token hash
   * 5. Send email (if user exists)
   * 6. Always return success (prevent email enumeration)
   *
   * @param request - Password reset request with email
   * @returns PasswordResetResponse (always success)
   */
  async requestPasswordReset(
    request: PasswordResetRequest
  ): Promise<PasswordResetResponse> {
    const email = normalizeEmail(request.email);

    // Step 1: Check rate limit
    const rateLimitResult = await this.rateLimiter.checkLimit('password_reset', email);
    if (!rateLimitResult.allowed) {
      throw new AuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many password reset requests. Please try again later.',
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Step 2: Find user by email
    const user = await this.userRepository.findByEmail(email);

    // Steps 3-5 only if user exists (but always return success)
    if (user) {
      // Step 3: Generate reset token
      const resetToken = this.tokenManager.generateRefreshToken();
      const resetTokenHash = this.tokenManager.hashToken(resetToken);
      const resetExpiry = new Date(
        Date.now() + this.config.passwordResetExpiry * 1000
      );

      // Step 4: Save token hash
      await this.userRepository.savePasswordResetToken(
        user.id,
        resetTokenHash,
        resetExpiry
      );

      // Step 5: Send email
      try {
        await this.emailService.sendPasswordResetEmail(email, resetToken);
      } catch (error) {
        console.error('Failed to send password reset email:', error);
      }
    }

    // Step 6: Always return success (prevent email enumeration)
    return {
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password using reset token
   *
   * Flow:
   * 1. Hash reset token
   * 2. Find user by token
   * 3. Validate token expiry
   * 4. Validate new password
   * 5. Hash new password
   * 6. Update password
   * 7. Clear reset token
   * 8. Revoke all refresh tokens
   *
   * @param request - Reset password request with token and new password
   * @returns ResetPasswordResponse
   * @throws AuthError if token is invalid
   */
  async resetPassword(
    request: ResetPasswordRequest
  ): Promise<ResetPasswordResponse> {
    // Step 1: Hash reset token
    const tokenHash = this.tokenManager.hashToken(request.token);

    // Step 2: Find user by token
    const user = await this.userRepository.findByPasswordResetToken(tokenHash);
    if (!user) {
      throw new AuthError(
        AuthErrorCode.INVALID_RESET_TOKEN,
        'Invalid or expired password reset token.'
      );
    }

    // Step 3: Validate token expiry
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new AuthError(
        AuthErrorCode.INVALID_RESET_TOKEN,
        'Password reset token has expired.'
      );
    }

    // Step 4: Validate new password
    const passwordValidation = validatePasswordStrength(request.newPassword);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        AuthErrorCode.PASSWORD_WEAK,
        passwordValidation.errors.join(' ')
      );
    }

    // Step 5: Hash new password
    const newPasswordHash = await this.passwordHasher.hash(request.newPassword);

    // Step 6: Update password
    await this.userRepository.updatePassword(user.id, newPasswordHash);

    // Step 7: Clear reset token
    await this.userRepository.clearPasswordResetToken(user.id);

    // Step 8: Revoke all refresh tokens (security measure)
    await this.tokenRepository.revokeAllUserTokens(user.id);

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  /**
   * Verify email address
   *
   * Flow:
   * 1. Hash verification token
   * 2. Find user by token
   * 3. Validate token expiry
   * 4. Mark email as verified
   * 5. Clear verification token
   *
   * @param request - Email verification request with token
   * @returns VerifyEmailResponse
   * @throws AuthError if token is invalid
   */
  async verifyEmail(request: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    // Step 1: Hash verification token
    const tokenHash = this.tokenManager.hashToken(request.token);

    // Step 2: Find user by token
    const user = await this.userRepository.findByVerificationToken(tokenHash);
    if (!user) {
      throw new AuthError(
        AuthErrorCode.INVALID_VERIFICATION_TOKEN,
        'Invalid or expired email verification token.'
      );
    }

    // Step 3: Validate token expiry
    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw new AuthError(
        AuthErrorCode.VERIFICATION_TOKEN_EXPIRED,
        'Email verification token has expired.'
      );
    }

    // Step 4: Mark email as verified
    await this.userRepository.setEmailVerified(user.id);

    return {
      success: true,
      message: 'Email verified successfully. You can now log in.',
    };
  }

  /**
   * Logout user by revoking refresh token
   *
   * Flow:
   * 1. Hash refresh token
   * 2. Revoke token in database
   * 3. Return success (idempotent)
   *
   * @param request - Logout request with refresh token
   * @returns LogoutResponse (always success)
   */
  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    // Step 1: Hash refresh token
    const tokenHash = this.tokenManager.hashToken(request.refreshToken);

    // Step 2: Revoke token (idempotent - doesn't fail if token doesn't exist)
    await this.tokenRepository.revokeRefreshToken(tokenHash);

    // Step 3: Return success
    return { success: true };
  }

  /**
   * Convert User to UserPublic (hide sensitive fields)
   */
  private toPublicUser(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}

/**
 * Factory function to create AuthService with all dependencies
 */
export function createAuthService(
  dependencies: AuthServiceDependencies,
  config?: Partial<AuthConfig>
): AuthService {
  return new AuthService(dependencies, config);
}
