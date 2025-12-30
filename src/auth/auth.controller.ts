/**
 * Authentication Controller
 * HTTP request handling and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  AuthError,
  AuthErrorCode,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  LogoutRequest,
} from './auth.types';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  logoutSchema,
} from './auth.validation';

export class AuthController {
  private readonly authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * POST /auth/register
   * Register a new user account
   */
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.register(result.data as RegisterRequest);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/login
   * Authenticate user and return tokens
   */
  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      // Get client info for token tracking
      const ipAddress = this.getClientIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      const response = await this.authService.login(
        result.data as LoginRequest,
        ipAddress,
        userAgent
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = refreshTokenSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.refreshToken(result.data as RefreshTokenRequest);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/request-password-reset
   * Request password reset email
   */
  requestPasswordReset = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = passwordResetRequestSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.requestPasswordReset(result.data as PasswordResetRequest);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/reset-password
   * Reset password using reset token
   */
  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = resetPasswordSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.resetPassword(result.data as ResetPasswordRequest);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/verify-email
   * Verify email address using verification token
   */
  verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = verifyEmailSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.verifyEmail(result.data as VerifyEmailRequest);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/logout
   * Logout user by revoking refresh token
   */
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body using Zod
      const result = logoutSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const response = await this.authService.logout(result.data as LogoutRequest);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Extract client IP address from request
   * Handles proxies (X-Forwarded-For) and direct connections
   */
  private getClientIp(req: Request): string {
    // Check for proxy headers
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Check for real IP header (nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to connection remote address
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }
}

/**
 * Error handling middleware for AuthError
 */
export function authErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error in auth controller:', error);

  res.status(500).json({
    success: false,
    error: AuthErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred. Please try again later.',
  });
}

/**
 * Factory function to create AuthController
 */
export function createAuthController(authService: AuthService): AuthController {
  return new AuthController(authService);
}
