/**
 * Profile Service Unit Tests
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * TDD RED Phase: These tests define the expected behavior of ProfileService
 * Following London School (mockist) approach - testing interactions and collaborations
 */

import { ProfileService } from '../../../src/profiles/profile.service';
import { ProfileRepository } from '../../../src/profiles/profile.repository';
import { ProfileCache } from '../../../src/profiles/profile.cache';
import {
  UserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  ProfileSearchFilters,
  ProfileErrorCodes,
} from '../../../src/profiles/profile.types';

// ============================================================
// Mock Setup - London School Approach
// ============================================================

jest.mock('../../../src/profiles/profile.repository');
jest.mock('../../../src/profiles/profile.cache');

describe('ProfileService', () => {
  let profileService: ProfileService;
  let mockRepository: jest.Mocked<ProfileRepository>;
  let mockCache: jest.Mocked<ProfileCache>;

  // Test fixtures
  const mockProfile: UserProfile = {
    id: 1,
    userId: 123,
    displayName: 'John Doe',
    bio: 'Software engineer passionate about open source',
    avatarUrl: 'https://cdn.example.com/avatars/user_123/avatar.webp',
    avatarS3Key: 'avatars/user_123/avatar.webp',
    coverImageUrl: null,
    coverImageS3Key: null,
    location: 'San Francisco, CA',
    website: 'https://johndoe.com',
    isPublic: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const validCreateInput: CreateProfileInput = {
    userId: 123,
    displayName: 'John Doe',
    bio: 'Software engineer passionate about open source',
    location: 'San Francisco, CA',
    website: 'https://johndoe.com',
    isPublic: true,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock instances
    mockRepository = new ProfileRepository() as jest.Mocked<ProfileRepository>;
    mockCache = new ProfileCache() as jest.Mocked<ProfileCache>;

    // Setup default mock implementations
    mockRepository.findByUserId = jest.fn();
    mockRepository.create = jest.fn();
    mockRepository.update = jest.fn();
    mockRepository.delete = jest.fn();
    mockRepository.searchByDisplayName = jest.fn();

    mockCache.get = jest.fn();
    mockCache.set = jest.fn();
    mockCache.invalidate = jest.fn();

    // Create service instance with mocked dependencies
    profileService = new ProfileService(mockRepository, mockCache);
  });

  // ============================================================
  // TEST: Create Profile
  // ============================================================
  describe('createProfile', () => {
    it('should create profile successfully with valid data', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(null); // No existing profile
      mockRepository.create.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.createProfile(validCreateInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(123);
      expect(mockRepository.create).toHaveBeenCalledWith(validCreateInput);
      expect(mockCache.set).toHaveBeenCalledWith(123, mockProfile);
    });

    it('should fail if profile already exists for user', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.createProfile(validCreateInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.PROFILE_ALREADY_EXISTS);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should validate display name length', async () => {
      // Arrange
      const invalidInput: CreateProfileInput = {
        ...validCreateInput,
        displayName: 'a'.repeat(101), // Exceeds 100 character limit
      };
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.createProfile(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.VALIDATION_ERROR);
    });

    it('should validate bio length', async () => {
      // Arrange
      const invalidInput: CreateProfileInput = {
        ...validCreateInput,
        bio: 'a'.repeat(501), // Exceeds 500 character limit
      };
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.createProfile(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.VALIDATION_ERROR);
    });

    it('should validate website URL format', async () => {
      // Arrange
      const invalidInput: CreateProfileInput = {
        ...validCreateInput,
        website: 'not-a-valid-url',
      };
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.createProfile(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.VALIDATION_ERROR);
    });

    it('should allow null website', async () => {
      // Arrange
      const inputWithNullWebsite: CreateProfileInput = {
        ...validCreateInput,
        website: null,
      };
      const profileWithNullWebsite = { ...mockProfile, website: null };
      mockRepository.findByUserId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(profileWithNullWebsite);

      // Act
      const result = await profileService.createProfile(inputWithNullWebsite);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.website).toBeNull();
    });
  });

  // ============================================================
  // TEST: Get Profile
  // ============================================================
  describe('getProfile', () => {
    it('should return user profile by userId', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null); // Cache miss
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.getProfile(123);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockCache.get).toHaveBeenCalledWith(123);
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(123);
      expect(mockCache.set).toHaveBeenCalledWith(123, mockProfile);
    });

    it('should return cached profile if available', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.getProfile(123);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockCache.get).toHaveBeenCalledWith(123);
      expect(mockRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('should return error if profile not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.getProfile(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.PROFILE_NOT_FOUND);
    });

    it('should respect privacy settings for non-public profiles', async () => {
      // Arrange
      const privateProfile = { ...mockProfile, isPublic: false };
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByUserId.mockResolvedValue(privateProfile);

      // Act
      const result = await profileService.getProfile(123, { requestingUserId: 456 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.FORBIDDEN);
    });

    it('should allow owner to view their own private profile', async () => {
      // Arrange
      const privateProfile = { ...mockProfile, isPublic: false };
      mockCache.get.mockResolvedValue(null);
      mockRepository.findByUserId.mockResolvedValue(privateProfile);

      // Act
      const result = await profileService.getProfile(123, { requestingUserId: 123 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(privateProfile);
    });
  });

  // ============================================================
  // TEST: Update Profile
  // ============================================================
  describe('updateProfile', () => {
    const updateInput: UpdateProfileInput = {
      displayName: 'Jane Doe',
      bio: 'Updated bio',
    };

    it('should update profile successfully', async () => {
      // Arrange
      const updatedProfile = {
        ...mockProfile,
        displayName: 'Jane Doe',
        bio: 'Updated bio',
        updatedAt: new Date(),
      };
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.update.mockResolvedValue(updatedProfile);

      // Act
      const result = await profileService.updateProfile(123, updateInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.displayName).toBe('Jane Doe');
      expect(result.data?.bio).toBe('Updated bio');
      expect(mockRepository.update).toHaveBeenCalledWith(123, updateInput);
      expect(mockCache.invalidate).toHaveBeenCalledWith(123);
    });

    it('should return error if profile not found', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.updateProfile(999, updateInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.PROFILE_NOT_FOUND);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should validate update data', async () => {
      // Arrange
      const invalidUpdate: UpdateProfileInput = {
        displayName: 'a'.repeat(101),
      };
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.updateProfile(123, invalidUpdate);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.VALIDATION_ERROR);
    });

    it('should invalidate cache after update', async () => {
      // Arrange
      const updatedProfile = { ...mockProfile, ...updateInput };
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.update.mockResolvedValue(updatedProfile);

      // Act
      await profileService.updateProfile(123, updateInput);

      // Assert
      expect(mockCache.invalidate).toHaveBeenCalledWith(123);
    });
  });

  // ============================================================
  // TEST: Upload Avatar
  // ============================================================
  describe('updateAvatar', () => {
    it('should update avatar URL and S3 key', async () => {
      // Arrange
      const avatarData = {
        avatarUrl: 'https://cdn.example.com/avatars/user_123/new_avatar.webp',
        avatarS3Key: 'avatars/user_123/new_avatar.webp',
      };
      const updatedProfile = { ...mockProfile, ...avatarData };
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.update.mockResolvedValue(updatedProfile);

      // Act
      const result = await profileService.updateAvatar(123, avatarData.avatarUrl, avatarData.avatarS3Key);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.avatarUrl).toBe(avatarData.avatarUrl);
      expect(result.data?.avatarS3Key).toBe(avatarData.avatarS3Key);
      expect(mockCache.invalidate).toHaveBeenCalledWith(123);
    });

    it('should return error if profile not found', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.updateAvatar(999, 'url', 's3key');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.PROFILE_NOT_FOUND);
    });
  });

  // ============================================================
  // TEST: Search Profiles
  // ============================================================
  describe('searchProfiles', () => {
    const searchFilters: ProfileSearchFilters = {
      query: 'john',
      limit: 20,
      offset: 0,
      sortBy: 'relevance',
      sortOrder: 'desc',
    };

    it('should return matching profiles for search query', async () => {
      // Arrange
      const searchResults = {
        profiles: [mockProfile],
        total: 1,
      };
      mockRepository.searchByDisplayName.mockResolvedValue(searchResults);

      // Act
      const result = await profileService.searchProfiles(searchFilters);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.profiles).toHaveLength(1);
      expect(result.data?.profiles?.[0]?.displayName).toBe('John Doe');
      expect(result.data?.total).toBe(1);
    });

    it('should return empty results for no matches', async () => {
      // Arrange
      mockRepository.searchByDisplayName.mockResolvedValue({
        profiles: [],
        total: 0,
      });

      // Act
      const result = await profileService.searchProfiles({
        ...searchFilters,
        query: 'nonexistent',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.profiles).toHaveLength(0);
      expect(result.data?.total).toBe(0);
    });

    it('should filter by location', async () => {
      // Arrange
      const filtersWithLocation = {
        ...searchFilters,
        location: 'San Francisco',
      };
      mockRepository.searchByDisplayName.mockResolvedValue({
        profiles: [mockProfile],
        total: 1,
      });

      // Act
      const result = await profileService.searchProfiles(filtersWithLocation);

      // Assert
      expect(result.success).toBe(true);
      expect(mockRepository.searchByDisplayName).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'San Francisco' })
      );
    });

    it('should only return public profiles', async () => {
      // Arrange
      mockRepository.searchByDisplayName.mockResolvedValue({
        profiles: [mockProfile], // Only public profile
        total: 1,
      });

      // Act
      const result = await profileService.searchProfiles(searchFilters);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.profiles.every(p => p.isPublic)).toBe(true);
    });

    it('should apply pagination correctly', async () => {
      // Arrange
      const paginatedFilters = {
        ...searchFilters,
        limit: 10,
        offset: 20,
      };
      // At offset 20 with total 25, we would get 5 profiles (21-25)
      mockRepository.searchByDisplayName.mockResolvedValue({
        profiles: Array(5).fill(mockProfile), // 5 profiles returned
        total: 25,
      });

      // Act
      const result = await profileService.searchProfiles(paginatedFilters);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(3); // offset 20 / limit 10 + 1 = page 3
      expect(result.data?.pageSize).toBe(10);
      // hasMore = offset + profiles.length < total = 20 + 5 < 25 = false
      expect(result.data?.hasMore).toBe(false);
    });

    it('should indicate hasMore when more results exist', async () => {
      // Arrange
      const paginatedFilters = {
        ...searchFilters,
        limit: 10,
        offset: 0,
      };
      mockRepository.searchByDisplayName.mockResolvedValue({
        profiles: Array(10).fill(mockProfile),
        total: 25,
      });

      // Act
      const result = await profileService.searchProfiles(paginatedFilters);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.hasMore).toBe(true);
    });
  });

  // ============================================================
  // TEST: Privacy Settings
  // ============================================================
  describe('updatePrivacySettings', () => {
    it('should update privacy settings and control profile visibility', async () => {
      // Arrange
      const privacySettings = {
        isPublic: false,
      };
      const updatedProfile = { ...mockProfile, isPublic: false };
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.update.mockResolvedValue(updatedProfile);

      // Act
      const result = await profileService.updatePrivacySettings(123, privacySettings);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.isPublic).toBe(false);
      expect(mockRepository.update).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ isPublic: false })
      );
    });

    it('should make profile public when isPublic is true', async () => {
      // Arrange
      const privateProfile = { ...mockProfile, isPublic: false };
      const publicProfile = { ...mockProfile, isPublic: true };
      mockRepository.findByUserId.mockResolvedValue(privateProfile);
      mockRepository.update.mockResolvedValue(publicProfile);

      // Act
      const result = await profileService.updatePrivacySettings(123, { isPublic: true });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.isPublic).toBe(true);
    });

    it('should invalidate cache after privacy settings change', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.update.mockResolvedValue({ ...mockProfile, isPublic: false });

      // Act
      await profileService.updatePrivacySettings(123, { isPublic: false });

      // Assert
      expect(mockCache.invalidate).toHaveBeenCalledWith(123);
    });
  });

  // ============================================================
  // TEST: Delete Profile
  // ============================================================
  describe('deleteProfile', () => {
    it('should delete profile successfully', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(mockProfile);
      mockRepository.delete.mockResolvedValue(true);

      // Act
      const result = await profileService.deleteProfile(123);

      // Assert
      expect(result.success).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith(123);
      expect(mockCache.invalidate).toHaveBeenCalledWith(123);
    });

    it('should return error if profile not found', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await profileService.deleteProfile(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.PROFILE_NOT_FOUND);
    });
  });

  // ============================================================
  // TEST: Error Handling
  // ============================================================
  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRepository.findByUserId.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await profileService.getProfile(123);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProfileErrorCodes.DATABASE_ERROR);
    });

    it('should handle cache errors and fallback to database', async () => {
      // Arrange
      mockCache.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      // Act
      const result = await profileService.getProfile(123);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });
  });
});
