/**
 * Profile Routes - Express router for User Profiles API
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Defines all HTTP endpoints for profile operations
 */

import { Router } from 'express';
import { ProfileController } from './profile.controller';

/**
 * Create profile routes
 * @param authMiddleware - Authentication middleware function
 * @param optionalAuthMiddleware - Optional auth middleware (for public routes)
 */
export function createProfileRoutes(
  authMiddleware: Router['use'] extends (arg: infer T) => unknown ? T : never,
  optionalAuthMiddleware?: Router['use'] extends (arg: infer T) => unknown ? T : never
): Router {
  const router = Router();
  const controller = new ProfileController();

  // ============================================================
  // Public Routes (with optional auth for privacy handling)
  // ============================================================

  /**
   * @route   GET /api/v1/profiles/search
   * @desc    Search profiles by query
   * @access  Public
   * @query   query, location, isPublic, hasAvatar, limit, offset, sortBy, sortOrder
   */
  if (optionalAuthMiddleware) {
    router.get('/search', optionalAuthMiddleware, controller.searchProfiles);
  } else {
    router.get('/search', controller.searchProfiles);
  }

  /**
   * @route   GET /api/v1/profiles/:userId
   * @desc    Get a user profile by ID
   * @access  Public (with privacy restrictions)
   * @param   userId - User ID
   */
  if (optionalAuthMiddleware) {
    router.get('/:userId', optionalAuthMiddleware, controller.getProfile);
  } else {
    router.get('/:userId', controller.getProfile);
  }

  // ============================================================
  // Protected Routes (require authentication)
  // ============================================================

  /**
   * @route   GET /api/v1/profiles/me
   * @desc    Get current user's profile
   * @access  Private
   */
  router.get('/me', authMiddleware, controller.getMyProfile);

  /**
   * @route   POST /api/v1/profiles
   * @desc    Create a new profile
   * @access  Private
   * @body    displayName, bio, location, website, isPublic
   */
  router.post('/', authMiddleware, controller.createProfile);

  /**
   * @route   PUT /api/v1/profiles/:userId
   * @desc    Update a profile
   * @access  Private (owner only)
   * @param   userId - User ID
   * @body    displayName, bio, location, website, isPublic
   */
  router.put('/:userId', authMiddleware, controller.updateProfile);

  /**
   * @route   DELETE /api/v1/profiles/:userId
   * @desc    Delete a profile
   * @access  Private (owner only)
   * @param   userId - User ID
   */
  router.delete('/:userId', authMiddleware, controller.deleteProfile);

  /**
   * @route   PUT /api/v1/profiles/:userId/avatar
   * @desc    Update profile avatar
   * @access  Private (owner only)
   * @param   userId - User ID
   * @body    avatarUrl, avatarS3Key
   */
  router.put('/:userId/avatar', authMiddleware, controller.updateAvatar);

  /**
   * @route   PUT /api/v1/profiles/:userId/cover
   * @desc    Update profile cover image
   * @access  Private (owner only)
   * @param   userId - User ID
   * @body    coverImageUrl, coverImageS3Key
   */
  router.put('/:userId/cover', authMiddleware, controller.updateCoverImage);

  /**
   * @route   PUT /api/v1/profiles/:userId/privacy
   * @desc    Update privacy settings
   * @access  Private (owner only)
   * @param   userId - User ID
   * @body    isPublic
   */
  router.put('/:userId/privacy', authMiddleware, controller.updatePrivacySettings);

  return router;
}

/**
 * Default export for simple usage without middleware
 */
export const profileRoutes = createProfileRoutes(
  // Default no-op middleware
  (req: unknown, res: unknown, next: () => void) => next()
);

export default profileRoutes;
