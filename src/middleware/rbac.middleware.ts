/**
 * RBAC Middleware - Permission Checking for Routes
 * M5 Groups & RBAC - Express Middleware
 *
 * Extracted for reusability across routes (REFACTOR phase)
 */

import { Request, Response, NextFunction } from 'express';
import { RBACService } from '../groups/rbac.service';
import { Permission, AuthenticatedUser } from '../groups/group.types';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Factory function to create permission-checking middleware
 */
export function createRBACMiddleware(rbacService: RBACService) {
  /**
   * Check if user has a specific permission in a group
   */
  function requirePermission(permission: Permission) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const result = await rbacService.checkPermission(
          req.user.id,
          groupId,
          permission
        );

        if (!result.allowed) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: permission,
            userRole: result.role,
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user has any of the specified permissions
   */
  function requireAnyPermission(permissions: Permission[]) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const results = await rbacService.checkPermissions(
          req.user.id,
          groupId,
          permissions
        );

        const hasAny = Object.values(results).some((allowed) => allowed);

        if (!hasAny) {
          res.status(403).json({
            error: 'Insufficient permissions',
            required: permissions,
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user has all of the specified permissions
   */
  function requireAllPermissions(permissions: Permission[]) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const results = await rbacService.checkPermissions(
          req.user.id,
          groupId,
          permissions
        );

        const hasAll = Object.values(results).every((allowed) => allowed);

        if (!hasAll) {
          const missing = permissions.filter((p) => !results[p]);
          res.status(403).json({
            error: 'Insufficient permissions',
            missing,
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user is at least a moderator
   */
  function requireModerator() {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const isMod = await rbacService.isModeratorOrAbove(req.user.id, groupId);

        if (!isMod) {
          res.status(403).json({
            error: 'Moderator access required',
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user is the owner
   */
  function requireOwner() {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const isOwner = await rbacService.isOwner(req.user.id, groupId);

        if (!isOwner) {
          res.status(403).json({
            error: 'Owner access required',
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user is a member of the group
   */
  function requireMembership() {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const groupId = req.params.groupId;
        if (!groupId) {
          res.status(400).json({ error: 'Group ID is required' });
          return;
        }

        const result = await rbacService.checkPermission(
          req.user.id,
          groupId,
          'view_group'
        );

        if (!result.role) {
          res.status(403).json({
            error: 'Group membership required',
          });
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireModerator,
    requireOwner,
    requireMembership,
  };
}

export type RBACMiddleware = ReturnType<typeof createRBACMiddleware>;
