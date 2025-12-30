/**
 * CommentController
 * HTTP request handlers for comment operations
 *
 * Endpoints:
 * - POST /api/v1/posts/:postId/comments - Create comment
 * - GET /api/v1/posts/:postId/comments - Get comment tree
 * - GET /api/v1/comments/:commentId - Get single comment
 * - PATCH /api/v1/comments/:commentId - Update comment
 * - DELETE /api/v1/comments/:commentId - Delete comment
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CommentService,
  CommentNotFoundError,
  PostNotFoundError,
  MaxDepthExceededError,
  EditWindowExpiredError,
  UnauthorizedError,
  ValidationError
} from './comment.service';
import {
  CommentSortOrder,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  MAX_COMMENT_LIMIT,
  DEFAULT_COMMENT_LIMIT
} from './comment.types';

// ============================================================================
// REQUEST SCHEMAS (Zod validation)
// ============================================================================

const createCommentSchema = z.object({
  content: z.string()
    .min(MIN_CONTENT_LENGTH, `Content must be at least ${MIN_CONTENT_LENGTH} character`)
    .max(MAX_CONTENT_LENGTH, `Content must not exceed ${MAX_CONTENT_LENGTH} characters`),
  parentCommentId: z.string().uuid().optional().nullable()
});

const updateCommentSchema = z.object({
  content: z.string()
    .min(MIN_CONTENT_LENGTH, `Content must be at least ${MIN_CONTENT_LENGTH} character`)
    .max(MAX_CONTENT_LENGTH, `Content must not exceed ${MAX_CONTENT_LENGTH} characters`)
});

const getCommentTreeQuerySchema = z.object({
  sort: z.enum(['newest', 'oldest', 'popular']).optional().default('newest'),
  limit: z.string().optional().transform(val => {
    const num = val ? parseInt(val, 10) : DEFAULT_COMMENT_LIMIT;
    return Math.min(Math.max(1, num), MAX_COMMENT_LIMIT);
  }),
  offset: z.string().optional().transform(val => {
    const num = val ? parseInt(val, 10) : 0;
    return Math.max(0, num);
  })
});

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// ============================================================================
// CONTROLLER
// ============================================================================

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * Create a new comment or reply
   * POST /api/v1/posts/:postId/comments
   */
  createComment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate authentication
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate path parameter
      const postId = req.params.postId;
      if (!postId) {
        res.status(400).json({ error: 'Post ID is required' });
        return;
      }

      // Validate request body
      const parseResult = createCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.errors
        });
        return;
      }

      const { content, parentCommentId } = parseResult.data;

      // Create comment
      const comment = await this.commentService.createComment(
        {
          postId,
          content,
          parentCommentId: parentCommentId || undefined
        },
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  /**
   * Get comment tree for a post
   * GET /api/v1/posts/:postId/comments
   */
  getCommentTree = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const postId = req.params.postId;
      if (!postId) {
        res.status(400).json({ error: 'Post ID is required' });
        return;
      }

      // Parse query parameters
      const parseResult = getCommentTreeQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.errors
        });
        return;
      }

      const { sort, limit, offset } = parseResult.data;

      // Get comment tree
      const result = await this.commentService.getCommentTree({
        postId,
        userId: req.user?.id || null,
        sort: sort as CommentSortOrder,
        limit,
        offset
      });

      res.status(200).json({
        success: true,
        data: result.comments,
        pagination: result.pagination,
        totalCount: result.totalCount
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  /**
   * Get a single comment
   * GET /api/v1/comments/:commentId
   */
  getComment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const commentId = req.params.commentId;
      if (!commentId) {
        res.status(400).json({ error: 'Comment ID is required' });
        return;
      }

      const comment = await this.commentService.getComment(commentId);

      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: comment
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  /**
   * Update a comment
   * PATCH /api/v1/comments/:commentId
   */
  updateComment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate authentication
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const commentId = req.params.commentId;
      if (!commentId) {
        res.status(400).json({ error: 'Comment ID is required' });
        return;
      }

      // Validate request body
      const parseResult = updateCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.errors
        });
        return;
      }

      // Update comment
      const comment = await this.commentService.updateComment(
        commentId,
        parseResult.data,
        req.user.id
      );

      res.status(200).json({
        success: true,
        data: comment
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  /**
   * Delete a comment
   * DELETE /api/v1/comments/:commentId
   */
  deleteComment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate authentication
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const commentId = req.params.commentId;
      if (!commentId) {
        res.status(400).json({ error: 'Comment ID is required' });
        return;
      }

      // Check for moderator role
      const isModerator = req.user.role === 'MODERATOR' || req.user.role === 'ADMIN';

      // Delete comment
      const result = await this.commentService.deleteComment(
        commentId,
        req.user.id,
        { isModerator }
      );

      res.status(200).json({
        success: true,
        message: result.message,
        deletedBy: result.deletedBy
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  private handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof CommentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof PostNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof MaxDepthExceededError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof EditWindowExpiredError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof UnauthorizedError) {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Pass unknown errors to Express error handler
    next(error);
  }
}
