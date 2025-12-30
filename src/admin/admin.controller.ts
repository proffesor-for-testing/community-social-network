/**
 * M8 Admin & Security Module - Admin Controller
 *
 * HTTP request handlers for admin operations
 * Implements REST API endpoints as per architecture specification
 */

import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import {
  AdminRole,
  AuditStatus,
} from './admin.types';

/**
 * Extended Request interface with admin user context
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
 * Admin Controller - HTTP Handlers
 *
 * Endpoints:
 * - POST /admin/auth/login - Initiate login
 * - POST /admin/auth/2fa/login - Complete 2FA login
 * - POST /admin/auth/2fa/setup - Setup 2FA
 * - POST /admin/auth/2fa/verify - Verify 2FA setup
 * - POST /admin/users/:id/warn - Warn a user
 * - POST /admin/users/:id/suspend - Suspend a user
 * - POST /admin/users/:id/ban - Ban a user
 */
export class AdminController {
  private adminService: AdminService;
  private auditService: AuditService;

  constructor(adminService: AdminService, auditService: AuditService) {
    this.adminService = adminService;
    this.auditService = auditService;
  }

  /**
   * POST /admin/auth/login
   * Initiate admin login with credentials
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const ipAddress = this.getClientIP(req);

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await this.adminService.initiateLogin(
        email,
        password,
        ipAddress
      );

      if (result.requires2FA) {
        res.status(200).json({
          success: true,
          requires2FA: true,
          tempToken: result.tempToken,
          message: 'Please provide 2FA code to complete login',
        });
      } else {
        this.setSessionCookie(res, result.sessionToken!);
        res.status(200).json({
          success: true,
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
        });
      }
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Authentication failed',
      });
    }
  }

  /**
   * POST /admin/auth/2fa/login
   * Complete 2FA login
   */
  async complete2FALogin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tempToken, totpCode } = req.body;
      const ipAddress = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';

      if (!tempToken || !totpCode) {
        res.status(400).json({
          success: false,
          error: 'Temp token and TOTP code are required',
        });
        return;
      }

      // Validate TOTP code format
      if (!/^\d{6}$/.test(totpCode)) {
        res.status(400).json({
          success: false,
          error: 'Invalid TOTP code format. Must be 6 digits.',
        });
        return;
      }

      const result = await this.adminService.completeLogin(
        tempToken,
        totpCode,
        ipAddress,
        userAgent
      );

      this.setSessionCookie(res, result.sessionToken!);
      res.status(200).json({
        success: true,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || '2FA verification failed',
      });
    }
  }

  /**
   * POST /admin/auth/2fa/setup
   * Setup 2FA for current admin user
   */
  async setup2FA(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await this.adminService.setup2FA(req.adminUser.id);

      res.status(200).json({
        success: true,
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
        message: 'Scan QR code with authenticator app and verify with a code',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to setup 2FA',
      });
    }
  }

  /**
   * POST /admin/auth/2fa/verify
   * Verify and enable 2FA
   */
  async verify2FA(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { totpCode } = req.body;

      if (!totpCode || !/^\d{6}$/.test(totpCode)) {
        res.status(400).json({
          success: false,
          error: 'Valid 6-digit TOTP code is required',
        });
        return;
      }

      await this.adminService.verify2FASetup(req.adminUser.id, totpCode);

      res.status(200).json({
        success: true,
        message: '2FA has been enabled successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || '2FA verification failed',
      });
    }
  }

  /**
   * POST /admin/users/:id/warn
   * Warn a user
   */
  async warnUser(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id: targetUserId } = req.params;
      const { reason } = req.body;
      const ipAddress = this.getClientIP(req);

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Reason is required',
        });
        return;
      }

      const result = await this.adminService.warnUser(
        req.adminUser.id,
        targetUserId,
        reason,
        ipAddress
      );

      res.status(200).json({
        success: true,
        actionId: result.actionId,
        message: 'User has been warned',
      });
    } catch (error: any) {
      const statusCode = error.message.includes('permission') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to warn user',
      });
    }
  }

  /**
   * POST /admin/users/:id/suspend
   * Suspend a user
   */
  async suspendUser(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id: targetUserId } = req.params;
      const { reason, durationDays = 7 } = req.body;
      const ipAddress = this.getClientIP(req);

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Reason is required',
        });
        return;
      }

      if (durationDays < 1 || durationDays > 365) {
        res.status(400).json({
          success: false,
          error: 'Duration must be between 1 and 365 days',
        });
        return;
      }

      const result = await this.adminService.suspendUser(
        req.adminUser.id,
        targetUserId,
        durationDays,
        reason,
        ipAddress
      );

      res.status(200).json({
        success: true,
        actionId: result.actionId,
        expiresAt: result.expiresAt,
        message: `User has been suspended for ${durationDays} days`,
      });
    } catch (error: any) {
      const statusCode = error.message.includes('permission') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to suspend user',
      });
    }
  }

  /**
   * POST /admin/users/:id/ban
   * Permanently ban a user
   */
  async banUser(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id: targetUserId } = req.params;
      const { reason } = req.body;
      const ipAddress = this.getClientIP(req);

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Reason is required',
        });
        return;
      }

      const result = await this.adminService.banUser(
        req.adminUser.id,
        targetUserId,
        reason,
        ipAddress
      );

      res.status(200).json({
        success: true,
        actionId: result.actionId,
        message: 'User has been permanently banned',
      });
    } catch (error: any) {
      const statusCode = error.message.includes('permission') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to ban user',
      });
    }
  }

  /**
   * POST /admin/auth/logout
   * Logout current admin session
   */
  async logout(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (req.adminUser) {
        await this.auditService.logAsync({
          action: 'auth.logout',
          adminId: req.adminUser.id,
          ipAddress: this.getClientIP(req),
          status: AuditStatus.SUCCESS,
        });
      }

      // Clear session cookie
      res.clearCookie('admin_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/admin',
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Logout failed',
      });
    }
  }

  /**
   * GET /admin/audit-logs
   * Query audit logs
   */
  async getAuditLogs(
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.adminUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Check permission
      const permissions = this.adminService.getPermissionsForRole(req.adminUser.role);
      if (!permissions.canViewAuditLogs) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view audit logs',
        });
        return;
      }

      const { userId, action, startDate, endDate, limit = 100, offset = 0 } = req.query;

      let logs;

      if (userId) {
        logs = await this.auditService.getLogsForUser(
          userId as string,
          { limit: Number(limit), offset: Number(offset) }
        );
      } else if (action) {
        logs = await this.auditService.getLogsByAction(
          action as string,
          { limit: Number(limit), offset: Number(offset) }
        );
      } else if (startDate && endDate) {
        logs = await this.auditService.getLogsInTimeRange(
          new Date(startDate as string),
          new Date(endDate as string),
          { limit: Number(limit), offset: Number(offset) }
        );
      } else {
        logs = await this.auditService.getLogsInTimeRange(
          new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          new Date(),
          { limit: Number(limit), offset: Number(offset) }
        );
      }

      res.status(200).json({
        success: true,
        total: logs.length,
        logs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve audit logs',
      });
    }
  }

  /**
   * Helper: Get client IP address
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Helper: Set secure session cookie
   */
  private setSessionCookie(res: Response, sessionToken: string): void {
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      path: '/admin',
    });
  }
}

/**
 * Create controller instance with dependencies
 */
export function createAdminController(
  adminService: AdminService,
  auditService: AuditService
): AdminController {
  return new AdminController(adminService, auditService);
}
