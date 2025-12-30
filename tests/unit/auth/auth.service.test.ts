/**
 * AuthService Unit Tests - TDD RED Phase (London School)
 *
 * These tests define the expected behavior of the AuthService.
 * Following London School TDD: we mock all dependencies and test interactions.
 *
 * Test Categories:
 * 1. User Registration
 * 2. User Login
 * 3. Token Refresh
 * 4. Password Reset
 * 5. Rate Limiting / Account Lockout
 */

import { AuthService } from '../../../src/auth/auth.service';
import { TokenManager } from '../../../src/auth/token.manager';
import { RateLimiter } from '../../../src/auth/rate.limiter';
import { PasswordHasher } from '../../../src/auth/password.hasher';
import { EmailService } from '../../../src/auth/email.service';
import {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PasswordResetRequest,
  User,
  AuthTokens,
  AuthError,
  AuthErrorCode,
} from '../../../src/auth/auth.types';

// Mock dependencies (London School approach - mock all collaborators)
const mockUserRepository = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByVerificationToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  incrementFailedAttempts: jest.fn(),
  resetFailedAttempts: jest.fn(),
  setAccountLocked: jest.fn(),
  savePasswordResetToken: jest.fn(),
  clearPasswordResetToken: jest.fn(),
  updatePassword: jest.fn(),
  setEmailVerified: jest.fn(),
};

const mockTokenRepository = {
  saveRefreshToken: jest.fn(),
  findRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  updateLastUsed: jest.fn(),
  deleteExpiredTokens: jest.fn(),
};

const mockTokenManager = {
  generateAccessToken: jest.fn() as jest.Mock,
  generateRefreshToken: jest.fn() as jest.Mock,
  verifyAccessToken: jest.fn() as jest.Mock,
  hashToken: jest.fn() as jest.Mock,
};

const mockRateLimiter = {
  checkLimit: jest.fn() as jest.Mock,
  checkAccountLockout: jest.fn() as jest.Mock,
  setAccountLockout: jest.fn() as jest.Mock,
  incrementFailedAttempt: jest.fn() as jest.Mock,
  resetFailedAttempts: jest.fn() as jest.Mock,
};

const mockPasswordHasher = {
  hash: jest.fn() as jest.Mock,
  verify: jest.fn() as jest.Mock,
};

const mockEmailService = {
  sendVerificationEmail: jest.fn() as jest.Mock,
  sendPasswordResetEmail: jest.fn() as jest.Mock,
};

describe('AuthService', () => {
  let authService: AuthService;

  const validUser: User = {
    id: 1,
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    accountLocked: false,
    lockoutExpiry: null,
    failedLoginAttempts: 0,
    lastFailedLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create fresh AuthService instance with mocked dependencies
    authService = new AuthService({
      userRepository: mockUserRepository,
      tokenRepository: mockTokenRepository,
      tokenManager: mockTokenManager as TokenManager,
      rateLimiter: mockRateLimiter as RateLimiter,
      passwordHasher: mockPasswordHasher as PasswordHasher,
      emailService: mockEmailService as EmailService,
    });

    // Default mock implementations
    mockRateLimiter.checkLimit.mockResolvedValue({ allowed: true, remaining: 5 });
    mockRateLimiter.checkAccountLockout.mockResolvedValue({ locked: false });
  });

  describe('User Registration', () => {
    const validRegisterRequest: RegisterRequest = {
      email: 'newuser@example.com',
      password: 'SecureP@ss123!',
    };

    it('should register new user with valid data', async () => {
      // Arrange: Set up mock expectations
      mockUserRepository.findByEmail.mockResolvedValue(null); // Email not taken
      mockPasswordHasher.hash.mockResolvedValue('$2b$12$hashedpassword');
      mockTokenManager.generateRefreshToken.mockReturnValue('verification-token-123');
      mockUserRepository.create.mockResolvedValue({
        ...validUser,
        id: 2,
        email: validRegisterRequest.email,
        emailVerified: false,
      });
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      // Act
      const result = await authService.register(validRegisterRequest);

      // Assert: Verify interactions (London School)
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('registration', expect.any(String));
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validRegisterRequest.email);
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith(validRegisterRequest.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegisterRequest.email,
          passwordHash: '$2b$12$hashedpassword',
        })
      );
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();

      // Assert: Verify result
      expect(result.success).toBe(true);
      expect(result.userId).toBe(2);
      expect(result.message).toContain('Registration successful');
    });

    it('should reject registration with duplicate email', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(validUser);

      // Act & Assert
      await expect(authService.register(validRegisterRequest)).rejects.toThrow(AuthError);

      try {
        await authService.register(validRegisterRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.EMAIL_EXISTS);
      }

      // Verify we never tried to create the user
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should reject registration when rate limited', async () => {
      // Arrange
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 3600
      });

      // Act & Assert
      await expect(authService.register(validRegisterRequest)).rejects.toThrow(AuthError);

      try {
        await authService.register(validRegisterRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.RATE_LIMIT_EXCEEDED);
      }

      // Verify we didn't proceed with registration
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should reject registration with weak password', async () => {
      // Arrange
      const weakPasswordRequest = {
        email: 'test@example.com',
        password: '123', // Too weak
      };
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.register(weakPasswordRequest)).rejects.toThrow(AuthError);

      try {
        await authService.register(weakPasswordRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.PASSWORD_WEAK);
      }
    });
  });

  describe('User Login', () => {
    const validLoginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'SecureP@ss123!',
    };

    const mockTokens: AuthTokens = {
      accessToken: 'jwt-access-token',
      refreshToken: 'refresh-token-uuid',
      expiresIn: 900,
    };

    it('should login user with correct credentials', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(validUser);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockTokenManager.generateAccessToken.mockReturnValue(mockTokens.accessToken);
      mockTokenManager.generateRefreshToken.mockReturnValue(mockTokens.refreshToken);
      mockTokenManager.hashToken.mockReturnValue('hashed-refresh-token');
      mockTokenRepository.saveRefreshToken.mockResolvedValue(undefined);
      mockUserRepository.resetFailedAttempts.mockResolvedValue(undefined);

      // Act
      const result = await authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0');

      // Assert: Verify interactions
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('login', '127.0.0.1');
      expect(mockRateLimiter.checkAccountLockout).toHaveBeenCalledWith(validUser.id);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validLoginRequest.email);
      expect(mockPasswordHasher.verify).toHaveBeenCalledWith(
        validLoginRequest.password,
        validUser.passwordHash
      );
      expect(mockTokenManager.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: validUser.id })
      );
      expect(mockTokenManager.generateRefreshToken).toHaveBeenCalled();
      expect(mockTokenRepository.saveRefreshToken).toHaveBeenCalled();
      expect(mockUserRepository.resetFailedAttempts).toHaveBeenCalledWith(validUser.id);

      // Assert: Verify result
      expect(result.success).toBe(true);
      expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(result.tokens.refreshToken).toBe(mockTokens.refreshToken);
      expect(result.user.id).toBe(validUser.id);
    });

    it('should reject login with wrong password', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(validUser);
      mockPasswordHasher.verify.mockResolvedValue(false);
      mockRateLimiter.incrementFailedAttempt.mockResolvedValue({
        attempts: 1,
        shouldLock: false,
      });

      // Act & Assert
      await expect(
        authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      try {
        await authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0');
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Verify failed attempt was recorded
      expect(mockRateLimiter.incrementFailedAttempt).toHaveBeenCalledWith(validUser.id);
    });

    it('should reject login for non-existent user', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      try {
        await authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0');
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      }
    });

    it('should reject login for unverified email', async () => {
      // Arrange
      const unverifiedUser = { ...validUser, emailVerified: false };
      mockUserRepository.findByEmail.mockResolvedValue(unverifiedUser);
      mockPasswordHasher.verify.mockResolvedValue(true);

      // Act & Assert
      await expect(
        authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      try {
        await authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0');
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.EMAIL_NOT_VERIFIED);
      }
    });

    it('should reject login for locked account', async () => {
      // Arrange - user must be found first, then lockout is checked
      mockUserRepository.findByEmail.mockResolvedValue(validUser);
      mockRateLimiter.checkAccountLockout.mockResolvedValue({
        locked: true,
        lockedUntil: new Date(Date.now() + 1800000), // 30 min from now
      });

      // Act & Assert
      await expect(
        authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      try {
        await authService.login(validLoginRequest, '127.0.0.1', 'Mozilla/5.0');
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      }

      // Verify lockout was checked but password was not verified
      expect(mockUserRepository.findByEmail).toHaveBeenCalled();
      expect(mockPasswordHasher.verify).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    const validRefreshRequest: RefreshTokenRequest = {
      refreshToken: 'valid-refresh-token',
    };

    it('should return new access token with valid refresh token', async () => {
      // Arrange
      const storedToken = {
        id: 1,
        userId: validUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        isRevoked: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-token');
      mockTokenRepository.findRefreshToken.mockResolvedValue(storedToken);
      mockUserRepository.findById.mockResolvedValue(validUser);
      mockTokenManager.generateAccessToken.mockReturnValue('new-access-token');
      mockTokenRepository.updateLastUsed.mockResolvedValue(undefined);

      // Act
      const result = await authService.refreshToken(validRefreshRequest);

      // Assert: Verify interactions
      expect(mockTokenManager.hashToken).toHaveBeenCalledWith(validRefreshRequest.refreshToken);
      expect(mockTokenRepository.findRefreshToken).toHaveBeenCalledWith('hashed-token');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(validUser.id);
      expect(mockTokenManager.generateAccessToken).toHaveBeenCalled();
      expect(mockTokenRepository.updateLastUsed).toHaveBeenCalledWith(storedToken.id);

      // Assert: Verify result
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(900);
    });

    it('should reject refresh with invalid token', async () => {
      // Arrange
      mockTokenManager.hashToken.mockReturnValue('hashed-invalid-token');
      mockTokenRepository.findRefreshToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken(validRefreshRequest)).rejects.toThrow(AuthError);

      try {
        await authService.refreshToken(validRefreshRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_REFRESH_TOKEN);
      }
    });

    it('should reject refresh with expired token', async () => {
      // Arrange
      const expiredToken = {
        id: 1,
        userId: validUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        isRevoked: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-token');
      mockTokenRepository.findRefreshToken.mockResolvedValue(expiredToken);

      // Act & Assert
      await expect(authService.refreshToken(validRefreshRequest)).rejects.toThrow(AuthError);

      try {
        await authService.refreshToken(validRefreshRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_REFRESH_TOKEN);
      }
    });

    it('should reject refresh with revoked token', async () => {
      // Arrange
      const revokedToken = {
        id: 1,
        userId: validUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 86400000),
        isRevoked: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-token');
      mockTokenRepository.findRefreshToken.mockResolvedValue(revokedToken);

      // Act & Assert
      await expect(authService.refreshToken(validRefreshRequest)).rejects.toThrow(AuthError);

      try {
        await authService.refreshToken(validRefreshRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_REFRESH_TOKEN);
      }
    });
  });

  describe('Password Reset', () => {
    const passwordResetRequest: PasswordResetRequest = {
      email: 'test@example.com',
    };

    it('should send password reset email for existing user', async () => {
      // Arrange
      mockRateLimiter.checkLimit.mockResolvedValue({ allowed: true, remaining: 2 });
      mockUserRepository.findByEmail.mockResolvedValue(validUser);
      mockTokenManager.generateRefreshToken.mockReturnValue('reset-token-123');
      mockTokenManager.hashToken.mockReturnValue('hashed-reset-token');
      mockUserRepository.savePasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      // Act
      const result = await authService.requestPasswordReset(passwordResetRequest);

      // Assert: Verify interactions
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('password_reset', expect.any(String));
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(passwordResetRequest.email);
      expect(mockUserRepository.savePasswordResetToken).toHaveBeenCalledWith(
        validUser.id,
        expect.any(String),
        expect.any(Date)
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        validUser.email,
        'reset-token-123'
      );

      // Assert: Verify result (always success to prevent email enumeration)
      expect(result.success).toBe(true);
      expect(result.message).toContain('password reset link has been sent');
    });

    it('should return success even for non-existent email (prevent enumeration)', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.requestPasswordReset(passwordResetRequest);

      // Assert: Always return success to prevent email enumeration
      expect(result.success).toBe(true);
      expect(result.message).toContain('password reset link has been sent');

      // Verify no email was sent
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reset password with valid token', async () => {
      // Arrange
      const resetPasswordRequest = {
        token: 'valid-reset-token',
        newPassword: 'NewSecureP@ss456!',
      };

      const userWithResetToken = {
        ...validUser,
        passwordResetToken: 'hashed-reset-token',
        passwordResetExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-reset-token');
      mockUserRepository.findByPasswordResetToken.mockResolvedValue(userWithResetToken);
      mockPasswordHasher.hash.mockResolvedValue('$2b$12$newhashedpassword');
      mockUserRepository.updatePassword.mockResolvedValue(undefined);
      mockUserRepository.clearPasswordResetToken.mockResolvedValue(undefined);
      mockTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);

      // Act
      const result = await authService.resetPassword(resetPasswordRequest);

      // Assert: Verify interactions
      expect(mockTokenManager.hashToken).toHaveBeenCalledWith(resetPasswordRequest.token);
      expect(mockUserRepository.findByPasswordResetToken).toHaveBeenCalledWith('hashed-reset-token');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith(resetPasswordRequest.newPassword);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(
        userWithResetToken.id,
        '$2b$12$newhashedpassword'
      );
      expect(mockUserRepository.clearPasswordResetToken).toHaveBeenCalledWith(userWithResetToken.id);
      expect(mockTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(userWithResetToken.id);

      // Assert: Verify result
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password reset successfully');
    });

    it('should reject password reset with invalid token', async () => {
      // Arrange
      const resetPasswordRequest = {
        token: 'invalid-reset-token',
        newPassword: 'NewSecureP@ss456!',
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-invalid-token');
      mockUserRepository.findByPasswordResetToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.resetPassword(resetPasswordRequest)).rejects.toThrow(AuthError);

      try {
        await authService.resetPassword(resetPasswordRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_RESET_TOKEN);
      }
    });

    it('should reject password reset with expired token', async () => {
      // Arrange
      const resetPasswordRequest = {
        token: 'expired-reset-token',
        newPassword: 'NewSecureP@ss456!',
      };

      const userWithExpiredToken = {
        ...validUser,
        passwordResetToken: 'hashed-expired-token',
        passwordResetExpiry: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockTokenManager.hashToken.mockReturnValue('hashed-expired-token');
      mockUserRepository.findByPasswordResetToken.mockResolvedValue(userWithExpiredToken);

      // Act & Assert
      await expect(authService.resetPassword(resetPasswordRequest)).rejects.toThrow(AuthError);

      try {
        await authService.resetPassword(resetPasswordRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_RESET_TOKEN);
      }
    });
  });

  describe('Rate Limiting and Account Lockout', () => {
    const loginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'WrongPassword123!',
    };

    it('should lock account after 5 failed login attempts', async () => {
      // Arrange
      const userWithFailures = {
        ...validUser,
        failedLoginAttempts: 4, // This will be the 5th attempt
      };

      mockUserRepository.findByEmail.mockResolvedValue(userWithFailures);
      mockPasswordHasher.verify.mockResolvedValue(false);
      mockRateLimiter.incrementFailedAttempt.mockResolvedValue({
        attempts: 5,
        shouldLock: true,
      });

      // Act & Assert
      await expect(
        authService.login(loginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      // Verify lockout was set
      expect(mockRateLimiter.setAccountLockout).toHaveBeenCalledWith(
        userWithFailures.id,
        expect.any(Number) // lockout duration
      );
    });

    it('should reject login when rate limited by IP', async () => {
      // Arrange
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 900, // 15 minutes
      });

      // Act & Assert
      await expect(
        authService.login(loginRequest, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(AuthError);

      try {
        await authService.login(loginRequest, '127.0.0.1', 'Mozilla/5.0');
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.RATE_LIMIT_EXCEEDED);
        expect((error as AuthError).retryAfter).toBe(900);
      }
    });

    it('should reset failed attempts after successful login', async () => {
      // Arrange
      const userWithFailures = {
        ...validUser,
        failedLoginAttempts: 3,
      };

      mockUserRepository.findByEmail.mockResolvedValue(userWithFailures);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockTokenManager.generateAccessToken.mockReturnValue('access-token');
      mockTokenManager.generateRefreshToken.mockReturnValue('refresh-token');
      mockTokenManager.hashToken.mockReturnValue('hashed-refresh-token');
      mockTokenRepository.saveRefreshToken.mockResolvedValue(undefined);
      mockRateLimiter.resetFailedAttempts.mockResolvedValue(undefined);
      mockUserRepository.resetFailedAttempts.mockResolvedValue(undefined);

      // Act
      await authService.login(
        { email: 'test@example.com', password: 'SecureP@ss123!' },
        '127.0.0.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(mockRateLimiter.resetFailedAttempts).toHaveBeenCalledWith(userWithFailures.id);
      expect(mockUserRepository.resetFailedAttempts).toHaveBeenCalledWith(userWithFailures.id);
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token', async () => {
      // Arrange
      const unverifiedUser = {
        ...validUser,
        emailVerified: false,
        emailVerificationToken: 'hashed-verification-token',
        emailVerificationExpiry: new Date(Date.now() + 86400000),
      };

      const verifyRequest = { token: 'verification-token' };

      mockTokenManager.hashToken.mockReturnValue('hashed-verification-token');
      mockUserRepository.findByEmail.mockImplementation(() => Promise.resolve(null));
      // Use a different mock method for verification token lookup
      mockUserRepository.findByEmail.mockResolvedValueOnce(unverifiedUser);
      mockUserRepository.setEmailVerified.mockResolvedValue(undefined);

      // For this test, we need to mock findByVerificationToken
      const mockFindByVerificationToken = jest.fn().mockResolvedValue(unverifiedUser);
      (authService as any).userRepository.findByVerificationToken = mockFindByVerificationToken;

      // Act
      const result = await authService.verifyEmail(verifyRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Email verified successfully');
    });

    it('should reject verification with invalid token', async () => {
      // Arrange
      const verifyRequest = { token: 'invalid-token' };
      mockTokenManager.hashToken.mockReturnValue('hashed-invalid-token');

      const mockFindByVerificationToken = jest.fn().mockResolvedValue(null);
      (authService as any).userRepository.findByVerificationToken = mockFindByVerificationToken;

      // Act & Assert
      await expect(authService.verifyEmail(verifyRequest)).rejects.toThrow(AuthError);

      try {
        await authService.verifyEmail(verifyRequest);
      } catch (error) {
        expect((error as AuthError).code).toBe(AuthErrorCode.INVALID_VERIFICATION_TOKEN);
      }
    });
  });

  describe('Logout', () => {
    it('should revoke refresh token on logout', async () => {
      // Arrange
      const logoutRequest = { refreshToken: 'valid-refresh-token' };
      mockTokenManager.hashToken.mockReturnValue('hashed-refresh-token');
      mockTokenRepository.revokeRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.logout(logoutRequest);

      // Assert
      expect(mockTokenManager.hashToken).toHaveBeenCalledWith(logoutRequest.refreshToken);
      expect(mockTokenRepository.revokeRefreshToken).toHaveBeenCalledWith('hashed-refresh-token');
      expect(result.success).toBe(true);
    });

    it('should succeed even with invalid token (idempotent)', async () => {
      // Arrange
      const logoutRequest = { refreshToken: 'invalid-refresh-token' };
      mockTokenManager.hashToken.mockReturnValue('hashed-invalid-token');
      mockTokenRepository.revokeRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.logout(logoutRequest);

      // Assert: Logout should always succeed (idempotent)
      expect(result.success).toBe(true);
    });
  });
});
