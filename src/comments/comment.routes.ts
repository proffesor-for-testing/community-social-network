/**
 * Comment Routes
 * Express router configuration for comment endpoints
 *
 * Routes:
 * - POST /api/v1/posts/:postId/comments - Create comment
 * - GET /api/v1/posts/:postId/comments - Get comment tree
 * - GET /api/v1/comments/:commentId - Get single comment
 * - PATCH /api/v1/comments/:commentId - Update comment
 * - DELETE /api/v1/comments/:commentId - Delete comment
 */

import { Router } from 'express';
import { CommentController } from './comment.controller';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthMiddleware {
  required: (req: any, res: any, next: any) => void;
  optional: (req: any, res: any, next: any) => void;
}

export interface RateLimitMiddleware {
  comments: (req: any, res: any, next: any) => void;
}

export interface CreateCommentRoutesOptions {
  controller: CommentController;
  authMiddleware: AuthMiddleware;
  rateLimitMiddleware?: RateLimitMiddleware;
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

/**
 * Create comment routes for posts (nested under /posts/:postId)
 */
export function createPostCommentRoutes(options: CreateCommentRoutesOptions): Router {
  const { controller, authMiddleware, rateLimitMiddleware } = options;
  const router = Router({ mergeParams: true }); // mergeParams to access :postId

  /**
   * POST /api/v1/posts/:postId/comments
   * Create a new comment or reply
   *
   * Authentication: Required
   * Rate Limit: 100 per hour
   */
  const createMiddleware = [authMiddleware.required];
  if (rateLimitMiddleware) {
    createMiddleware.push(rateLimitMiddleware.comments);
  }
  router.post('/', ...createMiddleware, controller.createComment);

  /**
   * GET /api/v1/posts/:postId/comments
   * Get comment tree for a post
   *
   * Authentication: Optional (for user-specific data like reactions)
   * Query params: sort, limit, offset
   */
  router.get('/', authMiddleware.optional, controller.getCommentTree);

  return router;
}

/**
 * Create comment routes for direct comment operations
 */
export function createCommentRoutes(options: CreateCommentRoutesOptions): Router {
  const { controller, authMiddleware } = options;
  const router = Router();

  /**
   * GET /api/v1/comments/:commentId
   * Get a single comment
   *
   * Authentication: Optional
   */
  router.get('/:commentId', authMiddleware.optional, controller.getComment);

  /**
   * PATCH /api/v1/comments/:commentId
   * Update a comment (within 5-minute edit window)
   *
   * Authentication: Required
   * Authorization: Comment author only
   */
  router.patch('/:commentId', authMiddleware.required, controller.updateComment);

  /**
   * DELETE /api/v1/comments/:commentId
   * Delete a comment
   *
   * Authentication: Required
   * Authorization: Author, Post Owner, or Moderator
   */
  router.delete('/:commentId', authMiddleware.required, controller.deleteComment);

  return router;
}

/**
 * Create all comment routes
 * Returns an object with both routers for mounting at different paths
 */
export function createAllCommentRoutes(options: CreateCommentRoutesOptions): {
  postCommentRouter: Router;
  commentRouter: Router;
} {
  return {
    postCommentRouter: createPostCommentRoutes(options),
    commentRouter: createCommentRoutes(options)
  };
}

// ============================================================================
// DEFAULT EXPORT - For simple setup
// ============================================================================

/**
 * Create a combined router with all comment endpoints
 * This requires a base path of /api/v1
 */
export function createCommentRouter(options: CreateCommentRoutesOptions): Router {
  const router = Router();
  const { postCommentRouter, commentRouter } = createAllCommentRoutes(options);

  // Mount post-specific comment routes
  router.use('/posts/:postId/comments', postCommentRouter);

  // Mount direct comment routes
  router.use('/comments', commentRouter);

  return router;
}

export default createCommentRouter;
