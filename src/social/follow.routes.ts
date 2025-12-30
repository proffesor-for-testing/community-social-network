/**
 * Follow Routes - Express Router Configuration
 * M6 Social Graph & Follow System
 *
 * This file defines all the routes for the social graph API.
 * All routes require authentication via JWT bearer token.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FollowController } from './follow.controller';

/**
 * Create social routes with the given controller.
 *
 * @param controller - The FollowController instance
 * @param authMiddleware - Authentication middleware function
 * @returns Configured Express router
 */
export function createSocialRoutes(
  controller: FollowController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authMiddleware);

  // ============================================================
  // FOLLOW ROUTES
  // ============================================================

  /**
   * POST /api/v1/social/follow/:userId
   * Follow a user
   *
   * Response:
   * - 200: { status: 'followed' | 'pending' | 'already_following', follow?: Follow }
   * - 400: Self-follow error
   * - 403: Blocked by user
   * - 404: User not found
   */
  router.post(
    '/follow/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.follow(req, res, next)
  );

  /**
   * DELETE /api/v1/social/unfollow/:userId
   * Unfollow a user
   *
   * Response:
   * - 204: Successfully unfollowed
   * - 404: Not following this user
   */
  router.delete(
    '/unfollow/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.unfollow(req, res, next)
  );

  // ============================================================
  // FOLLOW REQUEST ROUTES
  // ============================================================

  /**
   * GET /api/v1/social/follow-requests
   * Get pending follow requests
   *
   * Query params:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   *
   * Response:
   * - 200: { data: Follow[], pagination: Pagination }
   */
  router.get(
    '/follow-requests',
    (req: Request, res: Response, next: NextFunction) =>
      controller.getFollowRequests(req, res, next)
  );

  /**
   * POST /api/v1/social/follow-requests/:userId/approve
   * Approve a follow request
   *
   * Response:
   * - 200: { follow: Follow, message: string }
   * - 404: Follow request not found
   */
  router.post(
    '/follow-requests/:userId/approve',
    (req: Request, res: Response, next: NextFunction) =>
      controller.approveFollowRequest(req, res, next)
  );

  /**
   * POST /api/v1/social/follow-requests/:userId/reject
   * Reject a follow request
   *
   * Response:
   * - 204: Request rejected
   * - 404: Follow request not found
   */
  router.post(
    '/follow-requests/:userId/reject',
    (req: Request, res: Response, next: NextFunction) =>
      controller.rejectFollowRequest(req, res, next)
  );

  // ============================================================
  // FOLLOWER/FOLLOWING LIST ROUTES
  // ============================================================

  /**
   * GET /api/v1/social/followers/:userId
   * Get user's followers
   *
   * Query params:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   *
   * Response:
   * - 200: { data: FollowerInfo[], pagination: Pagination }
   * - 403: Private account, not authorized
   */
  router.get(
    '/followers/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.getFollowers(req, res, next)
  );

  /**
   * GET /api/v1/social/following/:userId
   * Get users that a user is following
   *
   * Query params:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   *
   * Response:
   * - 200: { data: FollowingInfo[], pagination: Pagination }
   */
  router.get(
    '/following/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.getFollowing(req, res, next)
  );

  // ============================================================
  // RELATIONSHIP ROUTES
  // ============================================================

  /**
   * GET /api/v1/social/relationship/:userId
   * Get relationship status with a user
   *
   * Response:
   * - 200: Relationship
   */
  router.get(
    '/relationship/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.getRelationship(req, res, next)
  );

  // ============================================================
  // BLOCK ROUTES
  // ============================================================

  /**
   * POST /api/v1/social/block/:userId
   * Block a user
   *
   * Body:
   * - reason?: string (optional)
   *
   * Response:
   * - 200: { success: true, message: string }
   * - 400: Cannot block yourself
   */
  router.post(
    '/block/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.block(req, res, next)
  );

  /**
   * DELETE /api/v1/social/unblock/:userId
   * Unblock a user
   *
   * Response:
   * - 204: Successfully unblocked
   * - 404: User not blocked
   */
  router.delete(
    '/unblock/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.unblock(req, res, next)
  );

  /**
   * GET /api/v1/social/blocks
   * Get blocked users
   *
   * Query params:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   *
   * Response:
   * - 200: { data: Block[], pagination: Pagination }
   */
  router.get(
    '/blocks',
    (req: Request, res: Response, next: NextFunction) =>
      controller.getBlocks(req, res, next)
  );

  /**
   * GET /api/v1/social/is-blocked/:userId
   * Check if a user is blocked
   *
   * Response:
   * - 200: { isBlocked: boolean }
   */
  router.get(
    '/is-blocked/:userId',
    (req: Request, res: Response, next: NextFunction) =>
      controller.isBlocked(req, res, next)
  );

  return router;
}

/**
 * Route summary for documentation:
 *
 * Follow System:
 * - POST   /api/v1/social/follow/:userId           - Follow a user
 * - DELETE /api/v1/social/unfollow/:userId         - Unfollow a user
 *
 * Follow Requests:
 * - GET    /api/v1/social/follow-requests          - Get pending requests
 * - POST   /api/v1/social/follow-requests/:userId/approve - Approve request
 * - POST   /api/v1/social/follow-requests/:userId/reject  - Reject request
 *
 * Lists:
 * - GET    /api/v1/social/followers/:userId        - Get user's followers
 * - GET    /api/v1/social/following/:userId        - Get user's following
 *
 * Relationship:
 * - GET    /api/v1/social/relationship/:userId     - Get relationship status
 *
 * Blocks:
 * - POST   /api/v1/social/block/:userId            - Block a user
 * - DELETE /api/v1/social/unblock/:userId          - Unblock a user
 * - GET    /api/v1/social/blocks                   - Get blocked users
 * - GET    /api/v1/social/is-blocked/:userId       - Check if blocked
 */
