/**
 * Authentication Module - Public API
 * Exports all public types, services, and utilities
 */

// Types
export {
  // Request types
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  LogoutRequest,
  // Response types
  RegisterResponse,
  LoginResponse,
  RefreshTokenResponse,
  PasswordResetResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
  LogoutResponse,
  // Token types
  AuthTokens,
  AccessTokenPayload,
  RefreshToken,
  // User types
  User,
  UserPublic,
  CreateUserData,
  // Rate limiting types
  RateLimitResult,
  AccountLockoutResult,
  FailedAttemptResult,
  // Error types
  AuthError,
  AuthErrorCode,
  // Repository interfaces
  UserRepository,
  TokenRepository,
  // Configuration
  AuthConfig,
  defaultAuthConfig,
  AuthServiceDependencies,
} from './auth.types';

// Validation
export {
  // Schemas
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  logoutSchema,
  passwordSchema,
  emailSchema,
  // Validation helpers
  validate,
  validatePasswordStrength,
  normalizeEmail,
  sanitizeInput,
  // Validation result types
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
  // Input types
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  PasswordResetRequestInput,
  ResetPasswordInput,
  VerifyEmailInput,
  LogoutInput,
} from './auth.validation';

// Services
export { AuthService, createAuthService } from './auth.service';
export {
  TokenManager,
  JwtTokenManager,
  createTokenManager,
} from './token.manager';
export {
  PasswordHasher,
  BcryptPasswordHasher,
  createPasswordHasher,
} from './password.hasher';
export {
  RateLimiter,
  RedisRateLimiter,
  InMemoryRateLimiter,
  createRateLimiter,
  RedisClient,
} from './rate.limiter';
export {
  EmailService,
  EmailProvider,
  TransactionalEmailService,
  MockEmailService,
  createEmailService,
} from './email.service';

// Controller and Routes
export {
  AuthController,
  createAuthController,
  authErrorHandler,
} from './auth.controller';
export {
  createAuthRouter,
  createAuthMiddleware,
} from './auth.routes';
