import { ProfileMapper } from '../mappers/profile.mapper';
import { ProfileEntity } from '../entities/profile.entity';
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

describe('ProfileMapper', () => {
  let mapper: ProfileMapper;

  beforeEach(() => {
    mapper = new ProfileMapper();
  });

  const createSampleProfile = (): Profile => {
    const id = ProfileId.create('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    const memberId = UserId.create('11111111-2222-3333-4444-555555555555');
    return Profile.reconstitute(
      id,
      memberId,
      DisplayName.create('Jane Doe'),
      Bio.create('Software engineer and writer'),
      AvatarId.create('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
      Location.create({ city: 'Berlin', country: 'Germany' }),
      PrivacySettings.create({
        profileVisibility: 'connections_only',
        showEmail: true,
        showLocation: false,
      }),
      Timestamp.fromDate(new Date('2024-01-15T10:00:00Z')),
      Timestamp.fromDate(new Date('2024-03-20T14:30:00Z')),
      3,
    );
  };

  const createSampleEntity = (): ProfileEntity => {
    const entity = new ProfileEntity();
    entity.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    entity.memberId = '11111111-2222-3333-4444-555555555555';
    entity.displayName = 'Jane Doe';
    entity.bio = 'Software engineer and writer';
    entity.avatarId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    entity.location = 'Berlin, Germany';
    entity.visibility = 'connections_only';
    entity.showEmail = true;
    entity.showLocation = false;
    entity.createdAt = new Date('2024-01-15T10:00:00Z');
    entity.updatedAt = new Date('2024-03-20T14:30:00Z');
    entity.version = 3;
    return entity;
  };

  describe('toDomain', () => {
    it('should map a persistence entity to a domain aggregate', () => {
      const entity = createSampleEntity();
      const profile = mapper.toDomain(entity);

      expect(profile.id.value).toBe(entity.id);
      expect(profile.memberId.value).toBe(entity.memberId);
      expect(profile.displayName.value).toBe(entity.displayName);
      expect(profile.bio.value).toBe(entity.bio);
      expect(profile.avatarId.value).toBe(entity.avatarId);
      expect(profile.location.city).toBe('Berlin');
      expect(profile.location.country).toBe('Germany');
      expect(profile.privacySettings.profileVisibility).toBe('connections_only');
      expect(profile.privacySettings.showEmail).toBe(true);
      expect(profile.privacySettings.showLocation).toBe(false);
      expect(profile.createdAt.value.toISOString()).toBe(
        entity.createdAt.toISOString(),
      );
      expect(profile.updatedAt.value.toISOString()).toBe(
        entity.updatedAt.toISOString(),
      );
      expect(profile.version).toBe(entity.version);
    });

    it('should handle null bio', () => {
      const entity = createSampleEntity();
      entity.bio = null;
      const profile = mapper.toDomain(entity);
      expect(profile.bio.value).toBe('');
    });

    it('should handle null avatar_id', () => {
      const entity = createSampleEntity();
      entity.avatarId = null;
      const profile = mapper.toDomain(entity);
      expect(profile.avatarId.value).toBeNull();
    });

    it('should handle null location', () => {
      const entity = createSampleEntity();
      entity.location = null;
      const profile = mapper.toDomain(entity);
      expect(profile.location.isEmpty).toBe(true);
    });

    it('should handle location with city only', () => {
      const entity = createSampleEntity();
      entity.location = 'Berlin';
      const profile = mapper.toDomain(entity);
      expect(profile.location.city).toBe('Berlin');
      expect(profile.location.country).toBeUndefined();
    });
  });

  describe('toPersistence', () => {
    it('should map a domain aggregate to a persistence entity', () => {
      const profile = createSampleProfile();
      const entity = mapper.toPersistence(profile);

      expect(entity.id).toBe(profile.id.value);
      expect(entity.memberId).toBe(profile.memberId.value);
      expect(entity.displayName).toBe(profile.displayName.value);
      expect(entity.bio).toBe(profile.bio.value);
      expect(entity.avatarId).toBe(profile.avatarId.value);
      expect(entity.location).toBe('Berlin, Germany');
      expect(entity.visibility).toBe('connections_only');
      expect(entity.showEmail).toBe(true);
      expect(entity.showLocation).toBe(false);
      expect(entity.createdAt.toISOString()).toBe(
        profile.createdAt.value.toISOString(),
      );
      expect(entity.updatedAt.toISOString()).toBe(
        profile.updatedAt.value.toISOString(),
      );
      expect(entity.version).toBe(profile.version);
    });

    it('should map empty bio to null', () => {
      const profile = Profile.reconstitute(
        ProfileId.create('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
        UserId.create('11111111-2222-3333-4444-555555555555'),
        DisplayName.create('Jane Doe'),
        Bio.empty(),
        AvatarId.none(),
        Location.empty(),
        PrivacySettings.default(),
        Timestamp.fromDate(new Date('2024-01-15T10:00:00Z')),
        Timestamp.fromDate(new Date('2024-01-15T10:00:00Z')),
        1,
      );
      const entity = mapper.toPersistence(profile);
      expect(entity.bio).toBeNull();
      expect(entity.avatarId).toBeNull();
      expect(entity.location).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should preserve all data through toPersistence -> toDomain', () => {
      const original = createSampleProfile();
      const entity = mapper.toPersistence(original);
      const reconstituted = mapper.toDomain(entity);

      expect(reconstituted.id.value).toBe(original.id.value);
      expect(reconstituted.memberId.value).toBe(original.memberId.value);
      expect(reconstituted.displayName.value).toBe(
        original.displayName.value,
      );
      expect(reconstituted.bio.value).toBe(original.bio.value);
      expect(reconstituted.avatarId.value).toBe(original.avatarId.value);
      expect(reconstituted.location.city).toBe(original.location.city);
      expect(reconstituted.location.country).toBe(original.location.country);
      expect(reconstituted.privacySettings.profileVisibility).toBe(
        original.privacySettings.profileVisibility,
      );
      expect(reconstituted.privacySettings.showEmail).toBe(
        original.privacySettings.showEmail,
      );
      expect(reconstituted.privacySettings.showLocation).toBe(
        original.privacySettings.showLocation,
      );
      expect(reconstituted.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(reconstituted.updatedAt.value.getTime()).toBe(
        original.updatedAt.value.getTime(),
      );
      expect(reconstituted.version).toBe(original.version);
    });

    it('should preserve data through toDomain -> toPersistence', () => {
      const originalEntity = createSampleEntity();
      const domain = mapper.toDomain(originalEntity);
      const roundTrippedEntity = mapper.toPersistence(domain);

      expect(roundTrippedEntity.id).toBe(originalEntity.id);
      expect(roundTrippedEntity.memberId).toBe(originalEntity.memberId);
      expect(roundTrippedEntity.displayName).toBe(originalEntity.displayName);
      expect(roundTrippedEntity.bio).toBe(originalEntity.bio);
      expect(roundTrippedEntity.avatarId).toBe(originalEntity.avatarId);
      expect(roundTrippedEntity.location).toBe(originalEntity.location);
      expect(roundTrippedEntity.visibility).toBe(originalEntity.visibility);
      expect(roundTrippedEntity.showEmail).toBe(originalEntity.showEmail);
      expect(roundTrippedEntity.showLocation).toBe(originalEntity.showLocation);
      expect(roundTrippedEntity.createdAt.toISOString()).toBe(
        originalEntity.createdAt.toISOString(),
      );
      expect(roundTrippedEntity.updatedAt.toISOString()).toBe(
        originalEntity.updatedAt.toISOString(),
      );
      expect(roundTrippedEntity.version).toBe(originalEntity.version);
    });
  });
});
