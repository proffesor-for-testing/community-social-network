/**
 * Social Graph Module - Public API
 * M6 Social Graph & Follow System
 *
 * This module provides all the components needed for
 * the social graph functionality including:
 * - Follow/Unfollow operations
 * - Block/Unblock operations
 * - Privacy enforcement
 * - HTTP routes and controllers
 */

// Types and Interfaces
export * from './social.types';

// Services
export { FollowService } from './follow.service';
export { BlockService } from './block.service';
export { PrivacyService } from './privacy.service';

// Controller
export { FollowController } from './follow.controller';

// Routes
export { createSocialRoutes } from './follow.routes';
