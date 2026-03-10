import { InMemoryProfileRepository } from '../repositories/in-memory-profile.repository';
import {
  Profile,
  ProfileId,
  DisplayName,
  Bio,
  AvatarId,
  Location,
  PrivacySettings,
} from '@csn/domain-profile';
import { UserId, Email, Timestamp } from '@csn/domain-shared';

describe('InMemoryProfileRepository', () => {
  let repository: InMemoryProfileRepository;

  beforeEach(() => {
    repository = new InMemoryProfileRepository();
  });

  const createProfile = (overrides?: {
    id?: string;
    memberId?: string;
    displayName?: string;
  }): Profile => {
    const id = ProfileId.create(
      overrides?.id ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    );
    const memberId = UserId.create(
      overrides?.memberId ?? '11111111-2222-3333-4444-555555555555',
    );
    return Profile.reconstitute(
      id,
      memberId,
      DisplayName.create(overrides?.displayName ?? 'Jane Doe'),
      Bio.create('A short bio'),
      AvatarId.create('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
      Location.create({ city: 'Berlin', country: 'Germany' }),
      PrivacySettings.default(),
      Timestamp.fromDate(new Date('2024-01-15T10:00:00Z')),
      Timestamp.fromDate(new Date('2024-01-15T10:00:00Z')),
      1,
    );
  };

  describe('nextId', () => {
    it('should generate a valid ProfileId', () => {
      const id = repository.nextId();
      expect(id).toBeDefined();
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique ids', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save', () => {
    it('should persist a profile', async () => {
      const profile = createProfile();
      await repository.save(profile);
      expect(repository.size).toBe(1);
    });

    it('should overwrite an existing profile with the same id', async () => {
      const profile = createProfile();
      await repository.save(profile);

      const updated = Profile.reconstitute(
        ProfileId.create(profile.id.value),
        profile.memberId,
        DisplayName.create('Updated Name'),
        profile.bio,
        profile.avatarId,
        profile.location,
        profile.privacySettings,
        profile.createdAt,
        Timestamp.now(),
        2,
      );
      await repository.save(updated);

      expect(repository.size).toBe(1);
      const found = await repository.findById(profile.id);
      expect(found?.displayName.value).toBe('Updated Name');
    });
  });

  describe('findById', () => {
    it('should return null when profile does not exist', async () => {
      const id = ProfileId.create('99999999-9999-9999-9999-999999999999');
      const result = await repository.findById(id);
      expect(result).toBeNull();
    });

    it('should return the profile when it exists', async () => {
      const profile = createProfile();
      await repository.save(profile);
      const found = await repository.findById(profile.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(profile.id.value);
      expect(found!.memberId.value).toBe(profile.memberId.value);
      expect(found!.displayName.value).toBe(profile.displayName.value);
      expect(found!.bio.value).toBe(profile.bio.value);
    });
  });

  describe('findByMemberId', () => {
    it('should return null when no profile matches the member id', async () => {
      const memberId = UserId.create(
        '99999999-9999-9999-9999-999999999999',
      );
      const result = await repository.findByMemberId(memberId);
      expect(result).toBeNull();
    });

    it('should return the profile matching the member id', async () => {
      const profile = createProfile();
      await repository.save(profile);

      const found = await repository.findByMemberId(profile.memberId);
      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(profile.id.value);
      expect(found!.memberId.value).toBe(profile.memberId.value);
    });

    it('should find the correct profile among multiple', async () => {
      const profile1 = createProfile({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        memberId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Alice',
      });
      const profile2 = createProfile({
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        memberId: '22222222-2222-2222-2222-222222222222',
        displayName: 'Bob',
      });

      await repository.save(profile1);
      await repository.save(profile2);

      const found = await repository.findByMemberId(
        UserId.create('22222222-2222-2222-2222-222222222222'),
      );
      expect(found).not.toBeNull();
      expect(found!.displayName.value).toBe('Bob');
    });
  });

  describe('exists', () => {
    it('should return false when profile does not exist', async () => {
      const id = ProfileId.create('99999999-9999-9999-9999-999999999999');
      expect(await repository.exists(id)).toBe(false);
    });

    it('should return true when profile exists', async () => {
      const profile = createProfile();
      await repository.save(profile);
      expect(await repository.exists(profile.id)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should remove a profile from the store', async () => {
      const profile = createProfile();
      await repository.save(profile);
      expect(repository.size).toBe(1);

      await repository.delete(profile);
      expect(repository.size).toBe(0);
      expect(await repository.findById(profile.id)).toBeNull();
    });

    it('should not throw when deleting a non-existent profile', async () => {
      const profile = createProfile();
      await expect(repository.delete(profile)).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all profiles', async () => {
      const profile1 = createProfile({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        memberId: '11111111-1111-1111-1111-111111111111',
      });
      const profile2 = createProfile({
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        memberId: '22222222-2222-2222-2222-222222222222',
      });

      await repository.save(profile1);
      await repository.save(profile2);
      expect(repository.size).toBe(2);

      repository.clear();
      expect(repository.size).toBe(0);
    });
  });
});
