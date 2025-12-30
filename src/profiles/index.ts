/**
 * Profile Module - Main entry point
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Exports all profile-related components
 */

// Types
export * from './profile.types';

// Services
export { ProfileService } from './profile.service';
export { MediaService } from './media.service';

// Data Access
export { ProfileRepository } from './profile.repository';
export { ProfileCache } from './profile.cache';

// HTTP Layer
export { ProfileController } from './profile.controller';
export { createProfileRoutes, profileRoutes } from './profile.routes';
