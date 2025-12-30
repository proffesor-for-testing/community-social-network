/**
 * Profile Service - Business logic for User Profiles
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * TDD GREEN Phase: Implementation to pass all tests
 * Following London School approach - clean separation of concerns
 */

import {
  UserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  ProfileSearchFilters,
  ProfileSearchResult,
  ProfileServiceResult,
  SearchServiceResult,
  ProfileErrorCodes,
  CreateProfileSchema,
  UpdateProfileSchema,
} from './profile.types';
import { ProfileRepository } from './profile.repository';
import { ProfileCache } from './profile.cache';

interface GetProfileOptions {
  requestingUserId?: number;
}

interface PrivacySettingsInput {
  isPublic: boolean;
}

export class ProfileService {
  private repository: ProfileRepository;
  private cache: ProfileCache;

  constructor(repository: ProfileRepository, cache: ProfileCache) {
    this.repository = repository;
    this.cache = cache;
  }

  /**
   * Create a new user profile
   */
  async createProfile(input: CreateProfileInput): Promise<ProfileServiceResult> {
    try {
      // Validate input
      const validationResult = this.validateCreateInput(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.VALIDATION_ERROR,
            message: validationResult.message,
            details: validationResult.details,
          },
        };
      }

      // Check if profile already exists
      const existingProfile = await this.repository.findByUserId(input.userId);
      if (existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_ALREADY_EXISTS,
            message: 'Profile already exists for this user',
          },
        };
      }

      // Create profile
      const profile = await this.repository.create(input);

      // Cache the new profile
      await this.cache.set(input.userId, profile);

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('Error creating profile:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to create profile',
        },
      };
    }
  }

  /**
   * Get a user profile by user ID
   */
  async getProfile(
    userId: number,
    options: GetProfileOptions = {}
  ): Promise<ProfileServiceResult> {
    try {
      // Try to get from cache first
      let profile: UserProfile | null = null;
      try {
        profile = await this.cache.get(userId);
      } catch {
        // Cache error, continue to database
      }

      // If not in cache, get from database
      if (!profile) {
        profile = await this.repository.findByUserId(userId);

        if (!profile) {
          return {
            success: false,
            error: {
              code: ProfileErrorCodes.PROFILE_NOT_FOUND,
              message: 'Profile not found',
            },
          };
        }

        // Cache the profile
        await this.cache.set(userId, profile);
      }

      // Check privacy settings
      if (!profile.isPublic && options.requestingUserId !== userId) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'This profile is private',
          },
        };
      }

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to retrieve profile',
        },
      };
    }
  }

  /**
   * Update a user profile
   */
  async updateProfile(
    userId: number,
    input: UpdateProfileInput
  ): Promise<ProfileServiceResult> {
    try {
      // Validate input
      const validationResult = this.validateUpdateInput(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.VALIDATION_ERROR,
            message: validationResult.message,
            details: validationResult.details,
          },
        };
      }

      // Check if profile exists
      const existingProfile = await this.repository.findByUserId(userId);
      if (!existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_NOT_FOUND,
            message: 'Profile not found',
          },
        };
      }

      // Update profile
      const updatedProfile = await this.repository.update(userId, input);

      // Invalidate cache
      await this.cache.invalidate(userId);

      return {
        success: true,
        data: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to update profile',
        },
      };
    }
  }

  /**
   * Update user avatar
   */
  async updateAvatar(
    userId: number,
    avatarUrl: string,
    avatarS3Key: string
  ): Promise<ProfileServiceResult> {
    try {
      // Check if profile exists
      const existingProfile = await this.repository.findByUserId(userId);
      if (!existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_NOT_FOUND,
            message: 'Profile not found',
          },
        };
      }

      // Update avatar
      const updatedProfile = await this.repository.update(userId, {
        avatarUrl,
        avatarS3Key,
      });

      // Invalidate cache
      await this.cache.invalidate(userId);

      return {
        success: true,
        data: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating avatar:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to update avatar',
        },
      };
    }
  }

  /**
   * Update user cover image
   */
  async updateCoverImage(
    userId: number,
    coverImageUrl: string,
    coverImageS3Key: string
  ): Promise<ProfileServiceResult> {
    try {
      // Check if profile exists
      const existingProfile = await this.repository.findByUserId(userId);
      if (!existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_NOT_FOUND,
            message: 'Profile not found',
          },
        };
      }

      // Update cover image
      const updatedProfile = await this.repository.update(userId, {
        coverImageUrl,
        coverImageS3Key,
      });

      // Invalidate cache
      await this.cache.invalidate(userId);

      return {
        success: true,
        data: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating cover image:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to update cover image',
        },
      };
    }
  }

  /**
   * Search profiles
   */
  async searchProfiles(filters: ProfileSearchFilters): Promise<SearchServiceResult> {
    try {
      const { profiles, total } = await this.repository.searchByDisplayName(filters);

      const page = Math.floor(filters.offset / filters.limit) + 1;
      const hasMore = filters.offset + profiles.length < total;

      const result: ProfileSearchResult = {
        profiles,
        total,
        page,
        pageSize: filters.limit,
        hasMore,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error searching profiles:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to search profiles',
        },
      };
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    userId: number,
    settings: PrivacySettingsInput
  ): Promise<ProfileServiceResult> {
    try {
      // Check if profile exists
      const existingProfile = await this.repository.findByUserId(userId);
      if (!existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_NOT_FOUND,
            message: 'Profile not found',
          },
        };
      }

      // Update privacy settings
      const updatedProfile = await this.repository.update(userId, {
        isPublic: settings.isPublic,
      });

      // Invalidate cache
      await this.cache.invalidate(userId);

      return {
        success: true,
        data: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to update privacy settings',
        },
      };
    }
  }

  /**
   * Delete a user profile
   */
  async deleteProfile(userId: number): Promise<ProfileServiceResult> {
    try {
      // Check if profile exists
      const existingProfile = await this.repository.findByUserId(userId);
      if (!existingProfile) {
        return {
          success: false,
          error: {
            code: ProfileErrorCodes.PROFILE_NOT_FOUND,
            message: 'Profile not found',
          },
        };
      }

      // Delete profile
      await this.repository.delete(userId);

      // Invalidate cache
      await this.cache.invalidate(userId);

      return {
        success: true,
        data: existingProfile,
      };
    } catch (error) {
      console.error('Error deleting profile:', error);
      return {
        success: false,
        error: {
          code: ProfileErrorCodes.DATABASE_ERROR,
          message: 'Failed to delete profile',
        },
      };
    }
  }

  /**
   * Validate create profile input
   */
  private validateCreateInput(input: CreateProfileInput): {
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } {
    const errors: string[] = [];

    // Validate display name length
    if (input.displayName && input.displayName.length > 100) {
      errors.push('Display name must be 100 characters or less');
    }

    // Validate bio length
    if (input.bio && input.bio.length > 500) {
      errors.push('Bio must be 500 characters or less');
    }

    // Validate location length
    if (input.location && input.location.length > 100) {
      errors.push('Location must be 100 characters or less');
    }

    // Validate website URL format
    if (input.website) {
      try {
        new URL(input.website);
      } catch {
        errors.push('Website must be a valid URL');
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        details: { errors },
      };
    }

    return { success: true, message: '' };
  }

  /**
   * Validate update profile input
   */
  private validateUpdateInput(input: UpdateProfileInput): {
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } {
    const errors: string[] = [];

    // Validate display name length
    if (input.displayName !== undefined && input.displayName.length > 100) {
      errors.push('Display name must be 100 characters or less');
    }

    // Validate bio length
    if (input.bio !== undefined && input.bio.length > 500) {
      errors.push('Bio must be 500 characters or less');
    }

    // Validate location length
    if (input.location !== undefined && input.location.length > 100) {
      errors.push('Location must be 100 characters or less');
    }

    // Validate website URL format
    if (input.website) {
      try {
        new URL(input.website);
      } catch {
        errors.push('Website must be a valid URL');
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        details: { errors },
      };
    }

    return { success: true, message: '' };
  }
}
