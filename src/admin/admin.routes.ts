/**
 * M8 Admin & Security Module - Express Routes
 *
 * Defines all admin API routes with middleware
 * Implements security best practices as per architecture
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AdminRole } from './admin.types';

/**
 * Extended Request with admin user context
 */
interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: AdminRole;
  };
  sessionId?: string;
}

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/**
 * Simple in-memory rate limiter (use redis-rate-limit in production)
 */
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.requests.get(key);

    if (!entry || now > entry.resetAt) {
      // Reset window
      this.requests.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: now + this.config.windowMs,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }
}

/**
 * Create admin routes with all endpoints
 */
export function createAdminRoutes(
  adminController: AdminController,
  adminService: AdminService,
  auditService: AuditService
): Router {
  const router = Router();

  // Rate limiters
  const loginRateLimiter = new InMemoryRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per window
  });

  const generalRateLimiter = new InMemoryRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  });

  /**
   * Middleware: Rate limiting for login endpoints
   */
  const loginRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIP(req);
    const result = loginRateLimiter.check(ip);

    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };

  /**
   * Middleware: General rate limiting
   */
  const generalRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIP(req);
    const result = generalRateLimiter.check(ip);

    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };

  /**
   * Middleware: Validate admin session
   */
  const requireAuth = async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Get session token from cookie or header
      const sessionToken =
        req.cookies?.admin_session ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // In production, validate session token and get user
      // For now, we'll use a mock validation
      // const session = await sessionService.validate(sessionToken);

      // Mock user for development
      req.adminUser = {
        id: 'mock-admin-id',
        email: 'admin@example.com',
        role: AdminRole.ADMIN,
      };

      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
      });
    }
  };

  /**
   * Middleware: Require specific role
   */
  const requireRole = (...allowedRoles: AdminRole[]) => {
    return (req: AdminRequest, res: Response, next: NextFunction) => {
      if (!req.adminUser) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (!allowedRoles.includes(req.adminUser.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
      }

      next();
    };
  };

  /**
   * Middleware: Validate request body
   */
  const validateBody = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const missingFields = requiredFields.filter(
        (field) => !req.body || req.body[field] === undefined
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      next();
    };
  };

  /**
   * Middleware: Security headers
   */
  const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );
    next();
  };

  // Apply security headers to all routes
  router.use(securityHeaders);

  // ========================================
  // Authentication Routes
  // ========================================

  /**
   * POST /admin/auth/login
   * Initiate login with credentials
   */
  router.post(
    '/auth/login',
    generalRateLimit,
    loginRateLimit,
    validateBody(['email', 'password']),
    (req, res, next) => adminController.login(req, res, next)
  );

  /**
   * POST /admin/auth/2fa/login
   * Complete 2FA login
   */
  router.post(
    '/auth/2fa/login',
    generalRateLimit,
    loginRateLimit,
    validateBody(['tempToken', 'totpCode']),
    (req, res, next) => adminController.complete2FALogin(req, res, next)
  );

  /**
   * POST /admin/auth/2fa/setup
   * Setup 2FA for current user
   */
  router.post(
    '/auth/2fa/setup',
    generalRateLimit,
    requireAuth,
    (req, res, next) => adminController.setup2FA(req as AdminRequest, res, next)
  );

  /**
   * POST /admin/auth/2fa/verify
   * Verify and enable 2FA
   */
  router.post(
    '/auth/2fa/verify',
    generalRateLimit,
    requireAuth,
    validateBody(['totpCode']),
    (req, res, next) => adminController.verify2FA(req as AdminRequest, res, next)
  );

  /**
   * POST /admin/auth/logout
   * Logout current session
   */
  router.post(
    '/auth/logout',
    generalRateLimit,
    requireAuth,
    (req, res, next) => adminController.logout(req as AdminRequest, res, next)
  );

  // ========================================
  // User Moderation Routes
  // ========================================

  /**
   * POST /admin/users/:id/warn
   * Warn a user
   */
  router.post(
    '/users/:id/warn',
    generalRateLimit,
    requireAuth,
    requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR),
    validateBody(['reason']),
    (req, res, next) => adminController.warnUser(req as AdminRequest, res, next)
  );

  /**
   * POST /admin/users/:id/suspend
   * Suspend a user
   */
  router.post(
    '/users/:id/suspend',
    generalRateLimit,
    requireAuth,
    requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR),
    validateBody(['reason']),
    (req, res, next) => adminController.suspendUser(req as AdminRequest, res, next)
  );

  /**
   * POST /admin/users/:id/ban
   * Permanently ban a user
   */
  router.post(
    '/users/:id/ban',
    generalRateLimit,
    requireAuth,
    requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
    validateBody(['reason']),
    (req, res, next) => adminController.banUser(req as AdminRequest, res, next)
  );

  // ========================================
  // Audit Log Routes
  // ========================================

  /**
   * GET /admin/audit-logs
   * Query audit logs
   */
  router.get(
    '/audit-logs',
    generalRateLimit,
    requireAuth,
    requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.AUDITOR),
    (req, res, next) => adminController.getAuditLogs(req as AdminRequest, res, next)
  );

  // ========================================
  // Health Check Route
  // ========================================

  /**
   * GET /admin/health
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

/**
 * Helper: Get client IP address
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Export route factory function
 */
export default createAdminRoutes;
