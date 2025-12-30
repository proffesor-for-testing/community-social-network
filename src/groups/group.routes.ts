/**
 * Group Routes - Express Router Configuration
 * M5 Groups & RBAC - API Endpoint Definitions
 */

import { Router } from 'express';
import { GroupController, AuthenticatedRequest } from './group.controller';
import { Response, NextFunction } from 'express';

/**
 * Create group routes with injected controller
 */
export function createGroupRoutes(groupController: GroupController): Router {
  const router = Router();

  // Wrapper to bind controller methods properly
  const wrap = (
    fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
  ) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      fn.call(groupController, req, res, next);
    };
  };

  // =====================
  // Group Management
  // =====================

  /**
   * Create a new group
   * POST /groups
   * @access Authenticated users
   */
  router.post('/', wrap(groupController.createGroup));

  /**
   * List groups
   * GET /groups
   * @access Public (public groups) / Authenticated (private groups)
   */
  router.get('/', wrap(groupController.listGroups));

  /**
   * Get group by ID
   * GET /groups/:groupId
   * @access Public (public groups) / Members only (private groups)
   */
  router.get('/:groupId', wrap(groupController.getGroup));

  /**
   * Update group
   * PATCH /groups/:groupId
   * @access Owner only
   */
  router.patch('/:groupId', wrap(groupController.updateGroup));

  /**
   * Delete group
   * DELETE /groups/:groupId
   * @access Owner only
   */
  router.delete('/:groupId', wrap(groupController.deleteGroup));

  // =====================
  // Membership Management
  // =====================

  /**
   * Join group or request membership
   * POST /groups/:groupId/members
   * @access Authenticated users
   */
  router.post('/:groupId/members', wrap(groupController.joinGroup));

  /**
   * Get group members
   * GET /groups/:groupId/members
   * @access Members only (private groups) / Public (public groups)
   */
  router.get('/:groupId/members', wrap(groupController.getMembers));

  /**
   * Leave group
   * DELETE /groups/:groupId/members/me
   * @access Authenticated members
   */
  router.delete('/:groupId/members/me', wrap(groupController.leaveGroup));

  /**
   * Remove member
   * DELETE /groups/:groupId/members/:userId
   * @access Moderators and above
   */
  router.delete('/:groupId/members/:userId', wrap(groupController.removeMember));

  // =====================
  // Role Management
  // =====================

  /**
   * Assign role to member
   * PATCH /groups/:groupId/members/:userId/role
   * @access Owner only
   */
  router.patch('/:groupId/members/:userId/role', wrap(groupController.assignRole));

  /**
   * Transfer ownership
   * POST /groups/:groupId/transfer-ownership
   * @access Owner only
   */
  router.post('/:groupId/transfer-ownership', wrap(groupController.transferOwnership));

  // =====================
  // Moderation Actions
  // =====================

  /**
   * Ban member
   * POST /groups/:groupId/members/:userId/ban
   * @access Moderators and above
   */
  router.post('/:groupId/members/:userId/ban', wrap(groupController.banMember));

  /**
   * Mute member
   * POST /groups/:groupId/members/:userId/mute
   * @access Moderators and above
   */
  router.post('/:groupId/members/:userId/mute', wrap(groupController.muteMember));

  return router;
}

/**
 * Default export for convenience
 */
export default createGroupRoutes;
