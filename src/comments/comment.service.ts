/**
 * CommentService
 * Handles comment CRUD operations with materialized path pattern
 *
 * Features:
 * - Create comments with depth validation (max 3 levels)
 * - Materialized path for efficient tree queries
 * - Soft delete with replies, hard delete without
 * - 5-minute edit window
 * - @mention integration
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Comment,
  CommentWithAuthor,
  CommentTreeNode,
  CommentTreeResponse,
  CreateCommentDTO,
  UpdateCommentDTO,
  GetCommentTreeParams,
  DeleteCommentResponse,
  DeletedBy,
  MAX_COMMENT_DEPTH,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  EDIT_WINDOW_MINUTES,
  DEFAULT_COMMENT_LIMIT
} from './comment.types';
import { MentionService } from './mention.service';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CommentRepository {
  findById(id: string): Promise<Comment | null>;
  findByPostId(postId: string): Promise<Comment[]>;
  findTreeByPostId(postId: string, options: { userId?: string | null; limit?: number; offset?: number; sort?: string }): Promise<CommentWithAuthor[]>;
  create(data: Partial<Comment>): Promise<Comment>;
  update(id: string, data: Partial<Comment>): Promise<Comment>;
  softDelete(id: string, deletedBy: DeletedBy): Promise<Comment>;
  hardDelete(id: string): Promise<void>;
  incrementRepliesCount(id: string): Promise<void>;
  decrementRepliesCount(id: string): Promise<void>;
  countReplies(id: string): Promise<number>;
}

export interface PostRepository {
  findById(id: string): Promise<{ id: string; authorId: string; isDeleted: boolean } | null>;
  incrementCommentsCount(postId: string): Promise<void>;
  decrementCommentsCount(postId: string): Promise<void>;
}

export interface NotificationService {
  notifyCommentCreated(data: {
    commentId: string;
    postId: string;
    authorId: string;
    postOwnerId: string;
  }): Promise<void>;
  notifyMention(data: {
    mentionedUserId: string;
    commentId: string;
    authorId: string;
    postId: string;
  }): Promise<void>;
}

export interface DeleteOptions {
  isPostOwner?: boolean;
  isModerator?: boolean;
}

// ============================================================================
// ERRORS
// ============================================================================

export class CommentNotFoundError extends Error {
  constructor(message = 'Comment not found') {
    super(message);
    this.name = 'CommentNotFoundError';
  }
}

export class PostNotFoundError extends Error {
  constructor(message = 'Post not found') {
    super(message);
    this.name = 'PostNotFoundError';
  }
}

export class MaxDepthExceededError extends Error {
  constructor() {
    super('Maximum comment depth exceeded. Comments can only be nested 3 levels deep.');
    this.name = 'MaxDepthExceededError';
  }
}

export class EditWindowExpiredError extends Error {
  constructor() {
    super(`Edit window has expired. Comments can only be edited within ${EDIT_WINDOW_MINUTES} minutes of creation.`);
    this.name = 'EditWindowExpiredError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository,
    private readonly mentionService: MentionService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Create a new comment or reply
   *
   * @param dto - Comment creation data
   * @param authorId - ID of the user creating the comment
   * @returns Created comment
   */
  async createComment(dto: CreateCommentDTO, authorId: string): Promise<Comment> {
    // Validate content
    this.validateContent(dto.content);

    // Verify post exists
    const post = await this.postRepository.findById(dto.postId);
    if (!post) {
      throw new PostNotFoundError();
    }

    let depth = 0;
    let path: string;
    let parentComment: Comment | null = null;

    // Handle reply (nested comment)
    if (dto.parentCommentId) {
      parentComment = await this.commentRepository.findById(dto.parentCommentId);

      if (!parentComment) {
        throw new CommentNotFoundError('Parent comment not found');
      }

      // Verify parent is on same post
      if (parentComment.postId !== dto.postId) {
        throw new ValidationError('Parent comment belongs to a different post');
      }

      // Validate depth
      const newDepth = parentComment.depth + 1;
      if (newDepth > MAX_COMMENT_DEPTH) {
        throw new MaxDepthExceededError();
      }

      depth = newDepth;
    }

    // Generate comment ID
    const commentId = uuidv4();

    // Generate materialized path
    if (parentComment) {
      path = `${parentComment.path}/${commentId}`;
    } else {
      path = commentId;
    }

    // Create comment
    const comment = await this.commentRepository.create({
      id: commentId,
      postId: dto.postId,
      authorId,
      parentCommentId: dto.parentCommentId || null,
      content: dto.content,
      path,
      depth,
      likesCount: 0,
      repliesCount: 0,
      isDeleted: false,
      deletedBy: null,
      editedAt: null
    });

    // Update counters
    await this.postRepository.incrementCommentsCount(dto.postId);

    if (parentComment) {
      await this.commentRepository.incrementRepliesCount(parentComment.id);
    }

    // Process mentions
    const mentions = this.mentionService.extractMentions(dto.content);
    if (mentions.length > 0) {
      const validMentions = await this.mentionService.validateMentions(mentions);
      if (validMentions.length > 0) {
        await this.mentionService.createMentions(comment.id, validMentions, {
          authorId,
          postId: dto.postId,
          notify: true
        });

        // Notify each mentioned user
        for (const mention of validMentions) {
          await this.notificationService.notifyMention({
            mentionedUserId: mention.userId,
            commentId: comment.id,
            authorId,
            postId: dto.postId
          });
        }
      }
    }

    // Notify post owner (if not commenting on own post)
    if (post.authorId !== authorId) {
      await this.notificationService.notifyCommentCreated({
        commentId: comment.id,
        postId: dto.postId,
        authorId,
        postOwnerId: post.authorId
      });
    }

    return comment;
  }

  /**
   * Update a comment (within edit window)
   *
   * @param commentId - ID of the comment to update
   * @param dto - Update data
   * @param userId - ID of the user requesting update
   * @returns Updated comment
   */
  async updateComment(commentId: string, dto: UpdateCommentDTO, userId: string): Promise<Comment> {
    // Validate content
    this.validateContent(dto.content);

    // Find comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new CommentNotFoundError();
    }

    // Check if deleted
    if (comment.isDeleted) {
      throw new ValidationError('Cannot edit a deleted comment');
    }

    // Check ownership
    if (comment.authorId !== userId) {
      throw new UnauthorizedError('Only the comment author can edit this comment');
    }

    // Check edit window
    const now = new Date();
    const createdAt = new Date(comment.createdAt);
    const editWindowMs = EDIT_WINDOW_MINUTES * 60 * 1000;
    const timeSinceCreation = now.getTime() - createdAt.getTime();

    if (timeSinceCreation > editWindowMs) {
      throw new EditWindowExpiredError();
    }

    // Update comment
    const updatedComment = await this.commentRepository.update(commentId, {
      content: dto.content,
      editedAt: now
    });

    return updatedComment;
  }

  /**
   * Delete a comment
   * - Soft delete if has replies (preserves tree structure)
   * - Hard delete if no replies
   *
   * @param commentId - ID of the comment to delete
   * @param userId - ID of the user requesting deletion
   * @param options - Delete options (isPostOwner, isModerator)
   * @returns Delete result
   */
  async deleteComment(
    commentId: string,
    userId: string,
    options: DeleteOptions = {}
  ): Promise<DeleteCommentResponse> {
    // Find comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new CommentNotFoundError();
    }

    // Determine who is deleting
    let deletedBy: DeletedBy;

    if (options.isModerator) {
      deletedBy = DeletedBy.MODERATOR;
    } else if (options.isPostOwner) {
      deletedBy = DeletedBy.POST_OWNER;
    } else if (comment.authorId === userId) {
      deletedBy = DeletedBy.AUTHOR;
    } else {
      // Check if user is post owner
      const post = await this.postRepository.findById(comment.postId);
      if (post && post.authorId === userId) {
        deletedBy = DeletedBy.POST_OWNER;
      } else {
        throw new UnauthorizedError('Not authorized to delete this comment');
      }
    }

    // Count replies to determine delete type
    const repliesCount = await this.commentRepository.countReplies(commentId);

    if (repliesCount > 0) {
      // Soft delete - preserve tree structure
      await this.commentRepository.softDelete(commentId, deletedBy);
    } else {
      // Hard delete - remove completely
      await this.commentRepository.hardDelete(commentId);

      // Update parent reply count
      if (comment.parentCommentId) {
        await this.commentRepository.decrementRepliesCount(comment.parentCommentId);
      }

      // Update post comment count
      await this.postRepository.decrementCommentsCount(comment.postId);
    }

    return {
      message: 'Comment deleted successfully',
      deletedBy
    };
  }

  /**
   * Get comment tree for a post
   *
   * Uses recursive CTE to load all comments in single query,
   * then builds tree structure in memory
   *
   * @param params - Query parameters
   * @returns Comment tree with pagination
   */
  async getCommentTree(params: GetCommentTreeParams): Promise<CommentTreeResponse> {
    const {
      postId,
      userId = null,
      sort = 'newest',
      limit = DEFAULT_COMMENT_LIMIT,
      offset = 0
    } = params;

    // Load flat comments from database
    const flatComments = await this.commentRepository.findTreeByPostId(postId, {
      userId,
      limit,
      offset,
      sort
    });

    if (flatComments.length === 0) {
      return {
        comments: [],
        pagination: { limit, offset, hasMore: false },
        totalCount: 0
      };
    }

    // Build tree structure
    const tree = this.buildCommentTree(flatComments, userId);

    return {
      comments: tree,
      pagination: {
        limit,
        offset,
        hasMore: flatComments.length === limit
      },
      totalCount: flatComments.length
    };
  }

  /**
   * Get a single comment by ID
   *
   * @param commentId - Comment ID
   * @returns Comment or null
   */
  async getComment(commentId: string): Promise<Comment | null> {
    return this.commentRepository.findById(commentId);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Validate comment content
   */
  private validateContent(content: string): void {
    if (!content || content.length < MIN_CONTENT_LENGTH) {
      throw new ValidationError('Comment content cannot be empty');
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ValidationError(`Comment content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }
  }

  /**
   * Build tree structure from flat comment array
   */
  private buildCommentTree(
    flatComments: CommentWithAuthor[],
    userId: string | null
  ): CommentTreeNode[] {
    // Create map of comments by ID
    const commentMap = new Map<string, CommentTreeNode>();

    // Initialize all nodes
    for (const comment of flatComments) {
      const node: CommentTreeNode = {
        ...comment,
        author: {
          id: comment.authorId,
          username: (comment as any).author?.username || 'unknown',
          avatarUrl: (comment as any).author?.avatarUrl || null
        },
        mentions: [],
        userReaction: (comment as any).userReaction || null,
        canEdit: this.canEdit(comment, userId),
        canDelete: this.canDelete(comment, userId),
        replies: []
      };
      commentMap.set(comment.id, node);
    }

    // Build tree by linking children to parents
    const rootComments: CommentTreeNode[] = [];

    for (const comment of flatComments) {
      const node = commentMap.get(comment.id)!;

      if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
        // Add to parent's replies
        const parent = commentMap.get(comment.parentCommentId)!;
        parent.replies.push(node);
      } else {
        // Root level comment
        rootComments.push(node);
      }
    }

    return rootComments;
  }

  /**
   * Check if user can edit comment
   */
  private canEdit(comment: Comment, userId: string | null): boolean {
    if (!userId || comment.authorId !== userId) {
      return false;
    }

    if (comment.isDeleted) {
      return false;
    }

    const now = new Date();
    const createdAt = new Date(comment.createdAt);
    const editWindowMs = EDIT_WINDOW_MINUTES * 60 * 1000;

    return (now.getTime() - createdAt.getTime()) <= editWindowMs;
  }

  /**
   * Check if user can delete comment
   */
  private canDelete(comment: Comment, userId: string | null): boolean {
    if (!userId) {
      return false;
    }

    // Author can always delete their own comments
    if (comment.authorId === userId) {
      return true;
    }

    // Post owners and moderators can delete - this would need additional context
    // For now, just check author
    return false;
  }
}
