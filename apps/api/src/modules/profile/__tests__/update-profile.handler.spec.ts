import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  Profile,
  ProfileId,
  DisplayName,
  Bio,
  AvatarId,
  Location,
  PrivacySettings,
  IProfileRepository,
} from '@csn/domain-profile';
import { UserId, Email, Timestamp } from '@csn/domain-shared';
import { UpdateProfileHandler } from '../commands/update-profile.handler';
import { UpdateProfileCommand } from '../commands/update-profile.command';

describe('UpdateProfileHandler', () => {
  let handler: UpdateProfileHandler;
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByMemberId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    nextId: ReturnType<typeof vi.fn>;
  };

  const profileIdStr = '550e8400-e29b-41d4-a716-446655440001';
  const memberIdStr = '550e8400-e29b-41d4-a716-446655440002';
  const otherMemberIdStr = '550e8400-e29b-41d4-a716-446655440099';

  function createTestProfile(): Profile {
    return Profile.reconstitute(
      ProfileId.create(profileIdStr),
      UserId.create(memberIdStr),
      DisplayName.create('Original Name'),
      Bio.create('Original bio'),
      AvatarId.none(),
      Location.create({ city: 'Old City', country: 'Old Country' }),
      PrivacySettings.default(),
      Timestamp.fromDate(new Date('2024-01-01T00:00:00Z')),
      Timestamp.fromDate(new Date('2024-01-01T00:00:00Z')),
      1,
    );
  }

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByMemberId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      nextId: vi.fn(),
    };

    handler = new UpdateProfileHandler(mockRepository as unknown as IProfileRepository);
  });

  it('should update display name', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      'New Name',
      undefined,
      undefined,
      undefined,
    );

    const result = await handler.execute(command);

    expect(result.displayName).toBe('New Name');
    expect(result.bio).toBe('Original bio');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('should update bio', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      undefined,
      'New bio text',
      undefined,
      undefined,
    );

    const result = await handler.execute(command);

    expect(result.bio).toBe('New bio text');
    expect(result.displayName).toBe('Original Name');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('should update location', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      undefined,
      undefined,
      'New York',
      'United States',
    );

    const result = await handler.execute(command);

    expect(result.city).toBe('New York');
    expect(result.country).toBe('United States');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('should update multiple fields at once', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      'Updated Name',
      'Updated bio',
      'London',
      'United Kingdom',
    );

    const result = await handler.execute(command);

    expect(result.displayName).toBe('Updated Name');
    expect(result.bio).toBe('Updated bio');
    expect(result.city).toBe('London');
    expect(result.country).toBe('United Kingdom');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('should throw NotFoundException when profile does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      'New Name',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when requester is not the profile owner', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      otherMemberIdStr,
      'Hacker Name',
    );

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should preserve existing location city when only country is updated', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      undefined,
      undefined,
      undefined,
      'New Country',
    );

    const result = await handler.execute(command);

    expect(result.city).toBe('Old City');
    expect(result.country).toBe('New Country');
  });

  it('should preserve existing location country when only city is updated', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      undefined,
      undefined,
      'New City',
      undefined,
    );

    const result = await handler.execute(command);

    expect(result.city).toBe('New City');
    expect(result.country).toBe('Old Country');
  });

  it('should return a valid ProfileResponseDto with all fields', async () => {
    const profile = createTestProfile();
    mockRepository.findById.mockResolvedValue(profile);

    const command = new UpdateProfileCommand(
      profileIdStr,
      memberIdStr,
      'Response Test',
    );

    const result = await handler.execute(command);

    expect(result.id).toBe(profileIdStr);
    expect(result.memberId).toBe(memberIdStr);
    expect(result.displayName).toBe('Response Test');
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });
});
