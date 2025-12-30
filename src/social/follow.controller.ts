/**
 * Follow Controller - HTTP Request Handlers
 * M6 Social Graph & Follow System
 *
 * This controller handles all HTTP requests for follow/unfollow operations.
 * It acts as the interface between Express routes and the Follow Service.
 */

import { Request, Response, NextFunction } from 'express';
import { IFollowService, IBlockService, SocialError } from './social.types';

/**
 * Extended Request type with authenticated user info.
 * Matches the project's existing auth middleware pattern.
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    emailVerified: boolean;
  };
}

/**
 * Helper to convert userId to string for service layer.
 */
function getUserIdString(userId: number): string {
  return String(userId);
}

export class FollowController {
  constructor(
    private readonly followService: IFollowService,
    private readonly blockService: IBlockService
  ) {}

  /**
   * POST /api/v1/social/follow/:userId
   * Follow a user
   */
  async follow(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const followingId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!followingId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const followerId = getUserIdString(userIdNum);
      const result = await this.followService.follow(followerId, followingId);

      res.status(200).json({
        status: result.status,
        follow: result.follow,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * DELETE /api/v1/social/unfollow/:userId
   * Unfollow a user
   */
  async unfollow(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const followingId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!followingId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const followerId = getUserIdString(userIdNum);
      await this.followService.unfollow(followerId, followingId);

      res.status(204).send();
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * POST /api/v1/social/follow-requests/:userId/approve
   * Approve a follow request
   */
  async approveFollowRequest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const requesterId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!requesterId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'Requester ID is required',
        });
        return;
      }

      const ownerId = getUserIdString(userIdNum);
      const result = await this.followService.approveFollowRequest(ownerId, requesterId);

      res.status(200).json({
        follow: result.follow,
        message: result.message,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * POST /api/v1/social/follow-requests/:userId/reject
   * Reject a follow request
   */
  async rejectFollowRequest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const requesterId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!requesterId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'Requester ID is required',
        });
        return;
      }

      const ownerId = getUserIdString(userIdNum);
      await this.followService.rejectFollowRequest(ownerId, requesterId);

      res.status(204).send();
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/followers/:userId
   * Get user's followers
   */
  async getFollowers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.params.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const result = await this.followService.getFollowers(userId, { page, limit });

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/following/:userId
   * Get users that a user is following
   */
  async getFollowing(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.params.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const result = await this.followService.getFollowing(userId, { page, limit });

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/follow-requests
   * Get pending follow requests
   */
  async getFollowRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const userId = getUserIdString(userIdNum);
      const result = await this.followService.getPendingRequests(userId, { page, limit });

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/relationship/:userId
   * Get relationship status with a user
   */
  async getRelationship(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const targetId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!targetId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'Target user ID is required',
        });
        return;
      }

      const userId = getUserIdString(userIdNum);
      const result = await this.followService.getRelationship(userId, targetId);

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * POST /api/v1/social/block/:userId
   * Block a user
   */
  async block(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const blockedId = req.params.userId;
      const reason = req.body.reason as string | undefined;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!blockedId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const blockerId = getUserIdString(userIdNum);
      const result = await this.blockService.block(blockerId, blockedId, reason);

      res.status(200).json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * DELETE /api/v1/social/unblock/:userId
   * Unblock a user
   */
  async unblock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const blockedId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!blockedId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        });
        return;
      }

      const blockerId = getUserIdString(userIdNum);
      await this.blockService.unblock(blockerId, blockedId);

      res.status(204).send();
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/blocks
   * Get blocked users
   */
  async getBlocks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const userId = getUserIdString(userIdNum);
      const result = await this.blockService.getBlocks(userId, { page, limit });

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * GET /api/v1/social/is-blocked/:userId
   * Check if a user is blocked
   */
  async isBlocked(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userIdNum = req.user?.userId;
      const targetId = req.params.userId;

      if (!userIdNum) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      if (!targetId) {
        res.status(400).json({
          code: 'MISSING_USER_ID',
          message: 'Target user ID is required',
        });
        return;
      }

      const userId = getUserIdString(userIdNum);
      const isBlocked = await this.blockService.isBlocked(userId, targetId);

      res.status(200).json({ isBlocked });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Handle errors from service layer
   */
  private handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof SocialError) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
      return;
    }

    // Pass unexpected errors to Express error handler
    next(error);
  }
}
