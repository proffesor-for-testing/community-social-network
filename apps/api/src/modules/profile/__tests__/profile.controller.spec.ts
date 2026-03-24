import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  Profile,
  ProfileId,
  DisplayName,
  Bio,
  AvatarId,
  Location,
  PrivacySettings,
} from '@csn/domain-profile';
import { UserId, Timestamp } from '@csn/domain-shared';
import { ProfileController } from '../controllers/profile.controller';
import { GetProfileHandler } from '../queries/get-profile.handler';
import { GetProfileByMemberHandler } from '../queries/get-profile-by-member.handler';
import { UpdateProfileHandler } from '../commands/update-profile.handler';
import { UploadAvatarHandler } from '../commands/upload-avatar.handler';
import { ProfileResponseDto } from '../dto/profile-response.dto';
import { AccessTokenPayload } from '@csn/infra-auth';

describe('ProfileController', () => {
  let controller: ProfileController;
  let getProfileHandler: { execute: ReturnType<typeof vi.fn> };
  let getProfileByMemberHandler: { execute: ReturnType<typeof vi.fn> };
  let updateProfileHandler: { execute: ReturnType<typeof vi.fn> };
  let uploadAvatarHandler: { execute: ReturnType<typeof vi.fn> };

  const profileIdStr = '550e8400-e29b-41d4-a716-446655440001';
  const memberIdStr = '550e8400-e29b-41d4-a716-446655440002';

  function createMockProfileResponse(): ProfileResponseDto {
    const profile = Profile.reconstitute(
      ProfileId.create(profileIdStr),
      UserId.create(memberIdStr),
      DisplayName.create('Test User'),
      Bio.create('A short bio'),
      AvatarId.none(),
      Location.create({ city: 'Seattle', country: 'USA' }),
      PrivacySettings.default(),
      Timestamp.fromDate(new Date('2024-01-01T00:00:00Z')),
      Timestamp.fromDate(new Date('2024-06-01T00:00:00Z')),
      1,
    );
    return ProfileResponseDto.fromDomain(profile);
  }

  function createMockUser(overrides?: Partial<AccessTokenPayload>): AccessTokenPayload {
    return {
      userId: memberIdStr,
      email: 'test@example.com',
      roles: ['member'],
      jti: 'jwt-id-1',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      ...overrides,
    };
  }

  beforeEach(() => {
    getProfileHandler = { execute: vi.fn() };
    getProfileByMemberHandler = { execute: vi.fn() };
    updateProfileHandler = { execute: vi.fn() };
    uploadAvatarHandler = { execute: vi.fn() };

    controller = new ProfileController(
      getProfileHandler as unknown as GetProfileHandler,
      getProfileByMemberHandler as unknown as GetProfileByMemberHandler,
      updateProfileHandler as unknown as UpdateProfileHandler,
      uploadAvatarHandler as unknown as UploadAvatarHandler,
    );
  });

  // ── GET /api/profiles/:id ──

  describe('GET /api/profiles/:id', () => {
    it('should return a profile by ID', async () => {
      const mockResponse = createMockProfileResponse();
      getProfileHandler.execute.mockResolvedValue(mockResponse);

      const result = await controller.getProfile(profileIdStr);

      expect(result).toEqual(mockResponse);
      expect(getProfileHandler.execute).toHaveBeenCalledOnce();
      expect(getProfileHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: profileIdStr }),
      );
    });

    it('should throw NotFoundException when profile does not exist', async () => {
      getProfileHandler.execute.mockRejectedValue(
        new NotFoundException('Profile not found'),
      );

      await expect(
        controller.getProfile(profileIdStr),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /api/profiles/member/:memberId ──

  describe('GET /api/profiles/member/:memberId', () => {
    it('should return a profile by member ID', async () => {
      const mockResponse = createMockProfileResponse();
      getProfileByMemberHandler.execute.mockResolvedValue(mockResponse);

      const result = await controller.getProfileByMember(memberIdStr);

      expect(result).toEqual(mockResponse);
      expect(getProfileByMemberHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: memberIdStr }),
      );
    });

    it('should throw NotFoundException when no profile exists for member', async () => {
      getProfileByMemberHandler.execute.mockRejectedValue(
        new NotFoundException('Profile not found for member'),
      );

      await expect(
        controller.getProfileByMember(memberIdStr),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /api/profiles/:id ──

  describe('PUT /api/profiles/:id', () => {
    it('should update profile with valid data', async () => {
      const mockResponse = createMockProfileResponse();
      updateProfileHandler.execute.mockResolvedValue(mockResponse);
      const user = createMockUser();

      const result = await controller.updateProfile(
        profileIdStr,
        { displayName: 'Updated Name', bio: 'Updated bio' },
        user,
      );

      expect(result).toEqual(mockResponse);
      expect(updateProfileHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: profileIdStr,
          requesterId: memberIdStr,
          displayName: 'Updated Name',
          bio: 'Updated bio',
        }),
      );
    });

    it('should pass partial update (only displayName)', async () => {
      const mockResponse = createMockProfileResponse();
      updateProfileHandler.execute.mockResolvedValue(mockResponse);
      const user = createMockUser();

      await controller.updateProfile(
        profileIdStr,
        { displayName: 'Only Name' },
        user,
      );

      expect(updateProfileHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: profileIdStr,
          requesterId: memberIdStr,
          displayName: 'Only Name',
          bio: undefined,
          city: undefined,
          country: undefined,
        }),
      );
    });

    it('should pass location fields to command', async () => {
      const mockResponse = createMockProfileResponse();
      updateProfileHandler.execute.mockResolvedValue(mockResponse);
      const user = createMockUser();

      await controller.updateProfile(
        profileIdStr,
        { city: 'Portland', country: 'US' },
        user,
      );

      expect(updateProfileHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          city: 'Portland',
          country: 'US',
        }),
      );
    });

    it('should propagate ForbiddenException from handler', async () => {
      updateProfileHandler.execute.mockRejectedValue(
        new ForbiddenException('You can only update your own profile'),
      );
      const user = createMockUser({ userId: '660e8400-e29b-41d4-a716-446655440099' });

      await expect(
        controller.updateProfile(
          profileIdStr,
          { displayName: 'Hacker' },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException from handler', async () => {
      updateProfileHandler.execute.mockRejectedValue(
        new NotFoundException('Profile not found'),
      );
      const user = createMockUser();

      await expect(
        controller.updateProfile(
          profileIdStr,
          { displayName: 'Ghost' },
          user,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /api/profiles/:id/avatar ──

  describe('POST /api/profiles/:id/avatar', () => {
    function createMockFile(overrides?: Partial<Express.Multer.File>): Express.Multer.File {
      return {
        fieldname: 'file',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
        ...overrides,
      };
    }

    it('should upload avatar successfully', async () => {
      const mockResponse = {
        avatarId: '770e8400-e29b-41d4-a716-446655440003',
        message: 'Avatar uploaded successfully',
      };
      uploadAvatarHandler.execute.mockResolvedValue(mockResponse);
      const user = createMockUser();
      const file = createMockFile();

      const result = await controller.uploadAvatar(profileIdStr, file, user);

      expect(result).toEqual(mockResponse);
      expect(uploadAvatarHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: profileIdStr,
          requesterId: memberIdStr,
          file,
        }),
      );
    });

    it('should propagate ForbiddenException from handler', async () => {
      uploadAvatarHandler.execute.mockRejectedValue(
        new ForbiddenException('You can only update your own profile'),
      );
      const user = createMockUser({ userId: '660e8400-e29b-41d4-a716-446655440099' });
      const file = createMockFile();

      await expect(
        controller.uploadAvatar(profileIdStr, file, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate BadRequestException for invalid file type', async () => {
      uploadAvatarHandler.execute.mockRejectedValue(
        new BadRequestException('Invalid file type'),
      );
      const user = createMockUser();
      const file = createMockFile({ mimetype: 'text/plain' });

      await expect(
        controller.uploadAvatar(profileIdStr, file, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException when profile not found', async () => {
      uploadAvatarHandler.execute.mockRejectedValue(
        new NotFoundException('Profile not found'),
      );
      const user = createMockUser();
      const file = createMockFile();

      await expect(
        controller.uploadAvatar(profileIdStr, file, user),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
