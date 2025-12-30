/**
 * Comments Module
 * M4 - Comments & Nested Discussions
 *
 * Exports all comment-related types, services, and controllers
 */

// Types
export * from './comment.types';

// Services
export { CommentService } from './comment.service';
export type { CommentRepository, PostRepository, NotificationService, DeleteOptions } from './comment.service';
export {
  CommentNotFoundError,
  PostNotFoundError,
  MaxDepthExceededError,
  EditWindowExpiredError,
  UnauthorizedError,
  ValidationError
} from './comment.service';

export { MentionService } from './mention.service';
export type {
  UserRepository,
  MentionRepository,
  NotificationService as MentionNotificationService,
  CreateMentionsOptions
} from './mention.service';

// Controller
export { CommentController } from './comment.controller';
export type { AuthenticatedRequest } from './comment.controller';

// Routes
export {
  createCommentRoutes,
  createPostCommentRoutes,
  createAllCommentRoutes,
  createCommentRouter
} from './comment.routes';
export type { AuthMiddleware, RateLimitMiddleware, CreateCommentRoutesOptions } from './comment.routes';
