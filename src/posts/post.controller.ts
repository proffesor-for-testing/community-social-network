/**
 * Post Controller
 * HTTP handlers for post operations
 */

import { Request, Response, NextFunction } from 'express';
import { PostService } from './post.service';
import { FeedService } from './feed.service';
import { ReactionService } from './reaction.service';
import { ReactionType } from './types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly feedService: FeedService,
    private readonly reactionService: ReactionService
  ) {}

  /**
   * Create a new post
   * POST /api/posts
   */
  createPost = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { content, groupId, visibility, mediaUrls } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const post = await this.postService.createPost({
        authorId: userId,
        content,
        groupId,
        visibility,
        mediaUrls,
      });

      res.status(201).json({
        success: true,
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a single post
   * GET /api/posts/:postId
   */
  getPost = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { postId } = req.params;

      const post = await this.postService.getPostWithAuthor(postId);

      res.json({
        success: true,
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Edit a post
   * PUT /api/posts/:postId
   */
  editPost = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { postId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const post = await this.postService.editPost(postId, userId, content);

      res.json({
        success: true,
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a post
   * DELETE /api/posts/:postId
   */
  deletePost = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { postId } = req.params;

      await this.postService.deletePost(postId, userId);

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get home feed
   * GET /api/feed
   */
  getHomeFeed = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const feed = await this.feedService.getHomeFeed(userId, cursor, limit);

      res.json({
        success: true,
        data: feed.items,
        pagination: {
          nextCursor: feed.nextCursor,
          hasMore: !!feed.nextCursor,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get group feed
   * GET /api/groups/:groupId/feed
   */
  getGroupFeed = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { groupId } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const feed = await this.feedService.getGroupFeed(
        groupId,
        userId,
        cursor,
        limit
      );

      res.json({
        success: true,
        data: feed.items,
        pagination: {
          nextCursor: feed.nextCursor,
          hasMore: !!feed.nextCursor,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user profile feed
   * GET /api/users/:userId/posts
   */
  getUserProfileFeed = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const feed = await this.feedService.getUserProfileFeed(
        userId,
        cursor,
        limit
      );

      res.json({
        success: true,
        data: feed.items,
        pagination: {
          nextCursor: feed.nextCursor,
          hasMore: !!feed.nextCursor,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle reaction on a post
   * POST /api/posts/:postId/reactions
   */
  toggleReaction = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { postId } = req.params;
      const { type } = req.body;

      if (!type || typeof type !== 'string') {
        res.status(400).json({ error: 'Reaction type is required' });
        return;
      }

      const result = await this.reactionService.toggleReaction(
        postId,
        userId,
        type as ReactionType
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get reaction counts for a post
   * GET /api/posts/:postId/reactions
   */
  getReactionCounts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { postId } = req.params;
      const userId = req.user?.id;

      const [counts, userReaction] = await Promise.all([
        this.reactionService.getReactionCounts(postId),
        userId
          ? this.reactionService.getUserReaction(postId, userId)
          : null,
      ]);

      res.json({
        success: true,
        data: {
          counts,
          userReaction: userReaction?.type || null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
