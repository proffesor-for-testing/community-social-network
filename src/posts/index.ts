/**
 * Posts Module Index
 * Exports all post-related services, repositories, and types
 */

// Types
export * from './types';

// Services
export { PostService, PostServiceError } from './post.service';
export { FeedService, FeedServiceError } from './feed.service';
export { ReactionService, ReactionServiceError } from './reaction.service';
export { SanitizerService, sanitizerService } from './sanitizer';
export { CacheService, CacheKeyBuilder, cacheService } from './cache.service';

// Repositories
export { PostRepository } from './post.repository';
export { FeedRepository } from './feed.repository';
export { ReactionRepository } from './reaction.repository';

// Controller
export { PostController, AuthenticatedRequest } from './post.controller';

// Routes
export {
  createPostRoutes,
  createFeedRoutes,
  createGroupFeedRoutes,
  createUserProfileRoutes,
} from './post.routes';
