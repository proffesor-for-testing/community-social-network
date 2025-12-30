/**
 * Profile Controller - HTTP request handlers for User Profiles
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Handles HTTP requests and responses for profile operations
 */

import { Request, Response, NextFunction } from 'express';
import { ProfileService } from './profile.service';
import { ProfileRepository } from './profile.repository';
import { ProfileCache } from './profile.cache';
import {
  CreateProfileInput,
  UpdateProfileInput,
  ProfileSearchFilters,
  ProfileErrorCodes,
} from './profile.types';

// Extend Express Request to include user info from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export class ProfileController {
  private service: ProfileService;

  constructor(service?: ProfileService) {
    // Allow dependency injection for testing, or create default instance
    if (service) {
      this.service = service;
    } else {
      const repository = new ProfileRepository();
      const cache = new ProfileCache();
      this.service = new ProfileService(repository, cache);
    }

    // Bind methods to preserve 'this' context
    this.createProfile = this.createProfile.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.deleteProfile = this.deleteProfile.bind(this);
    this.searchProfiles = this.searchProfiles.bind(this);
    this.updateAvatar = this.updateAvatar.bind(this);
    this.updateCoverImage = this.updateCoverImage.bind(this);
    this.updatePrivacySettings = this.updatePrivacySettings.bind(this);
    this.getMyProfile = this.getMyProfile.bind(this);
  }

  /**
   * Create a new profile
   * POST /api/v1/profiles
   */
  async createProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const input: CreateProfileInput = {
        userId,
        displayName: req.body.displayName,
        bio: req.body.bio,
        location: req.body.location,
        website: req.body.website,
        isPublic: req.body.isPublic ?? true,
      };

      const result = await this.service.createProfile(input);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a profile by user ID
   * GET /api/v1/profiles/:userId
   */
  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      const requestingUserId = req.user?.id;
      const result = await this.service.getProfile(userId, { requestingUserId });

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's profile
   * GET /api/v1/profiles/me
   */
  async getMyProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await this.service.getProfile(userId, { requestingUserId: userId });

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a profile
   * PUT /api/v1/profiles/:userId
   */
  async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      // Check authorization - users can only update their own profile
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'Not authorized to update this profile',
          },
        });
        return;
      }

      const input: UpdateProfileInput = {
        displayName: req.body.displayName,
        bio: req.body.bio,
        location: req.body.location,
        website: req.body.website,
        isPublic: req.body.isPublic,
      };

      // Remove undefined fields
      Object.keys(input).forEach(key => {
        if ((input as Record<string, unknown>)[key] === undefined) {
          delete (input as Record<string, unknown>)[key];
        }
      });

      const result = await this.service.updateProfile(userId, input);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a profile
   * DELETE /api/v1/profiles/:userId
   */
  async deleteProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      // Check authorization
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'Not authorized to delete this profile',
          },
        });
        return;
      }

      const result = await this.service.deleteProfile(userId);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json({ success: true, message: 'Profile deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search profiles
   * GET /api/v1/profiles/search
   */
  async searchProfiles(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters: ProfileSearchFilters = {
        query: req.query.query as string || '',
        location: req.query.location as string | undefined,
        isPublic: req.query.isPublic === 'true' ? true : req.query.isPublic === 'false' ? false : undefined,
        hasAvatar: req.query.hasAvatar === 'true' ? true : req.query.hasAvatar === 'false' ? false : undefined,
        limit: Math.min(parseInt(req.query.limit as string, 10) || 20, 100),
        offset: parseInt(req.query.offset as string, 10) || 0,
        sortBy: (req.query.sortBy as 'relevance' | 'created_at' | 'display_name') || 'relevance',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      if (!filters.query || filters.query.length < 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
        return;
      }

      const result = await this.service.searchProfiles(filters);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update avatar
   * PUT /api/v1/profiles/:userId/avatar
   */
  async updateAvatar(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      // Check authorization
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'Not authorized to update this profile',
          },
        });
        return;
      }

      const { avatarUrl, avatarS3Key } = req.body;
      if (!avatarUrl || !avatarS3Key) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'avatarUrl and avatarS3Key are required',
          },
        });
        return;
      }

      const result = await this.service.updateAvatar(userId, avatarUrl, avatarS3Key);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cover image
   * PUT /api/v1/profiles/:userId/cover
   */
  async updateCoverImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      // Check authorization
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'Not authorized to update this profile',
          },
        });
        return;
      }

      const { coverImageUrl, coverImageS3Key } = req.body;
      if (!coverImageUrl || !coverImageS3Key) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'coverImageUrl and coverImageS3Key are required',
          },
        });
        return;
      }

      const result = await this.service.updateCoverImage(userId, coverImageUrl, coverImageS3Key);

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update privacy settings
   * PUT /api/v1/profiles/:userId/privacy
   */
  async updatePrivacySettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        });
        return;
      }

      // Check authorization
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: ProfileErrorCodes.FORBIDDEN,
            message: 'Not authorized to update this profile',
          },
        });
        return;
      }

      const { isPublic } = req.body;
      if (typeof isPublic !== 'boolean') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'isPublic must be a boolean',
          },
        });
        return;
      }

      const result = await this.service.updatePrivacySettings(userId, { isPublic });

      if (!result.success) {
        const statusCode = this.getStatusCodeForError(result.error?.code);
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Map error codes to HTTP status codes
   */
  private getStatusCodeForError(errorCode?: string): number {
    switch (errorCode) {
      case ProfileErrorCodes.PROFILE_NOT_FOUND:
        return 404;
      case ProfileErrorCodes.PROFILE_ALREADY_EXISTS:
        return 409;
      case ProfileErrorCodes.VALIDATION_ERROR:
        return 400;
      case ProfileErrorCodes.UNAUTHORIZED:
        return 401;
      case ProfileErrorCodes.FORBIDDEN:
        return 403;
      case ProfileErrorCodes.DATABASE_ERROR:
      default:
        return 500;
    }
  }
}
