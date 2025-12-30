/**
 * Post Routes
 * Express router for post-related endpoints
 */

import { Router } from 'express';
import { PostController } from './post.controller';

/**
 * Create post routes
 * Requires authenticated middleware to be applied before these routes
 */
export function createPostRoutes(controller: PostController): Router {
  const router = Router();

  // Post CRUD operations
  router.post('/', controller.createPost);
  router.get('/:postId', controller.getPost);
  router.put('/:postId', controller.editPost);
  router.delete('/:postId', controller.deletePost);

  // Reactions
  router.post('/:postId/reactions', controller.toggleReaction);
  router.get('/:postId/reactions', controller.getReactionCounts);

  return router;
}

/**
 * Create feed routes
 */
export function createFeedRoutes(controller: PostController): Router {
  const router = Router();

  // Home feed
  router.get('/', controller.getHomeFeed);

  return router;
}

/**
 * Create group feed routes
 * To be mounted at /api/groups
 */
export function createGroupFeedRoutes(controller: PostController): Router {
  const router = Router();

  // Group feed
  router.get('/:groupId/feed', controller.getGroupFeed);

  return router;
}

/**
 * Create user profile routes
 * To be mounted at /api/users
 */
export function createUserProfileRoutes(controller: PostController): Router {
  const router = Router();

  // User's posts
  router.get('/:userId/posts', controller.getUserProfileFeed);

  return router;
}
