/**
 * Authentication Routes
 * Express router configuration for auth endpoints
 */

import { Router } from 'express';
import { AuthController, authErrorHandler } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Create authentication routes
 *
 * Routes:
 * - POST /auth/register - Register new user
 * - POST /auth/login - Login user
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/logout - Logout user
 * - POST /auth/verify-email - Verify email address
 * - POST /auth/request-password-reset - Request password reset
 * - POST /auth/reset-password - Reset password
 *
 * @param authService - Configured AuthService instance
 * @returns Express Router with auth routes
 */
export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = new AuthController(authService);

  // Public routes (no authentication required)

  /**
   * @route POST /auth/register
   * @desc Register a new user account
   * @access Public
   * @body { email: string, password: string }
   * @returns { success: boolean, userId: number, email: string, message: string }
   */
  router.post('/register', controller.register);

  /**
   * @route POST /auth/login
   * @desc Authenticate user and return tokens
   * @access Public
   * @body { email: string, password: string }
   * @returns { success: boolean, tokens: { accessToken, refreshToken, expiresIn }, user: UserPublic }
   */
  router.post('/login', controller.login);

  /**
   * @route POST /auth/refresh
   * @desc Refresh access token using refresh token
   * @access Public
   * @body { refreshToken: string }
   * @returns { success: boolean, accessToken: string, expiresIn: number }
   */
  router.post('/refresh', controller.refreshToken);

  /**
   * @route POST /auth/logout
   * @desc Logout user by revoking refresh token
   * @access Public
   * @body { refreshToken: string }
   * @returns { success: boolean }
   */
  router.post('/logout', controller.logout);

  /**
   * @route POST /auth/verify-email
   * @desc Verify email address using verification token
   * @access Public
   * @body { token: string }
   * @returns { success: boolean, message: string }
   */
  router.post('/verify-email', controller.verifyEmail);

  /**
   * @route POST /auth/request-password-reset
   * @desc Request password reset email
   * @access Public
   * @body { email: string }
   * @returns { success: boolean, message: string }
   */
  router.post('/request-password-reset', controller.requestPasswordReset);

  /**
   * @route POST /auth/reset-password
   * @desc Reset password using reset token
   * @access Public
   * @body { token: string, newPassword: string }
   * @returns { success: boolean, message: string }
   */
  router.post('/reset-password', controller.resetPassword);

  // Apply error handler
  router.use(authErrorHandler);

  return router;
}

/**
 * Authentication middleware for protected routes
 * Verifies JWT access token and attaches user info to request
 */
export function createAuthMiddleware(
  tokenManager: import('./token.manager').TokenManager
) {
  return async (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'No access token provided.',
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const payload = tokenManager.verifyAccessToken(token);

      // Attach user info to request
      (req as any).user = {
        userId: payload.userId,
        email: payload.email,
        emailVerified: payload.emailVerified,
      };

      next();
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthError') {
        res.status(401).json({
          success: false,
          error: (error as any).code,
          message: error.message,
        });
        return;
      }

      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired access token.',
      });
    }
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        emailVerified: boolean;
      };
    }
  }
}
