import { describe, it, expect } from 'vitest';
import { UserId, Email, Timestamp } from '@csn/domain-shared';
import { Profile } from '../aggregates/profile';
import { ProfileId } from '../value-objects/profile-id';
import { DisplayName } from '../value-objects/display-name';
import { Bio } from '../value-objects/bio';
import { AvatarId } from '../value-objects/avatar-id';
import { Location } from '../value-objects/location';
import { PrivacySettings } from '../value-objects/privacy-settings';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { ProfileUpdatedEvent } from '../events/profile-updated.event';
import { AvatarChangedEvent } from '../events/avatar-changed.event';

function createTestProfile(): Profile {
  const id = ProfileId.generate();
  const memberId = UserId.generate();
  const displayName = DisplayName.create('Alice Smith');
  const email = Email.create('alice@example.com');
  return Profile.create(id, memberId, displayName, email);
}

describe('Profile Aggregate', () => {
  describe('create', () => {
    it('should create a profile with correct initial state', () => {
      const id = ProfileId.generate();
      const memberId = UserId.generate();
      const displayName = DisplayName.create('Alice Smith');
      const email = Email.create('alice@example.com');

      const profile = Profile.create(id, memberId, displayName, email);

      expect(profile.id.equals(id)).toBe(true);
      expect(profile.memberId.equals(memberId)).toBe(true);
      expect(profile.displayName.value).toBe('Alice Smith');
      expect(profile.bio.value).toBe('');
      expect(profile.avatarId.value).toBeNull();
      expect(profile.location.isEmpty).toBe(true);
      expect(profile.privacySettings.profileVisibility).toBe('public');
      expect(profile.privacySettings.showEmail).toBe(false);
      expect(profile.privacySettings.showLocation).toBe(true);
      expect(profile.version).toBe(0);
    });

    it('should emit ProfileCreatedEvent on creation', () => {
      const profile = createTestProfile();

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProfileCreatedEvent);

      const event = events[0] as ProfileCreatedEvent;
      expect(event.aggregateId).toBe(profile.id.value);
      expect(event.displayName).toBe(profile.displayName.value);
      expect(event.aggregateType).toBe('Profile');
      expect(event.eventType).toBe('ProfileCreated');
    });
  });

  describe('updateDisplayName', () => {
    it('should change the display name', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents(); // clear creation event

      const newName = DisplayName.create('Bob Jones');
      profile.updateDisplayName(newName);

      expect(profile.displayName.value).toBe('Bob Jones');
    });

    it('should emit ProfileUpdatedEvent with displayName change', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      profile.updateDisplayName(DisplayName.create('Bob Jones'));

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProfileUpdatedEvent);

      const event = events[0] as ProfileUpdatedEvent;
      expect(event.changes).toEqual(['displayName']);
    });

    it('should increment version', () => {
      const profile = createTestProfile();
      expect(profile.version).toBe(0);

      profile.updateDisplayName(DisplayName.create('Bob Jones'));

      expect(profile.version).toBe(1);
    });
  });

  describe('updateBio', () => {
    it('should change the bio', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      const newBio = Bio.create('Software engineer and coffee enthusiast.');
      profile.updateBio(newBio);

      expect(profile.bio.value).toBe('Software engineer and coffee enthusiast.');
    });

    it('should emit ProfileUpdatedEvent with bio change', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      profile.updateBio(Bio.create('New bio'));

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProfileUpdatedEvent);
      expect((events[0] as ProfileUpdatedEvent).changes).toEqual(['bio']);
    });
  });

  describe('changeAvatar', () => {
    it('should set the avatar id', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      const avatarId = AvatarId.generate();
      profile.changeAvatar(avatarId);

      expect(profile.avatarId.value).toBe(avatarId.value);
      expect(profile.avatarId.hasValue).toBe(true);
    });

    it('should emit AvatarChangedEvent with new avatar id', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      const avatarId = AvatarId.generate();
      profile.changeAvatar(avatarId);

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AvatarChangedEvent);

      const event = events[0] as AvatarChangedEvent;
      expect(event.avatarId).toBe(avatarId.value);
    });
  });

  describe('removeAvatar', () => {
    it('should set avatar to null', () => {
      const profile = createTestProfile();
      profile.changeAvatar(AvatarId.generate());
      profile.pullDomainEvents();

      profile.removeAvatar();

      expect(profile.avatarId.value).toBeNull();
      expect(profile.avatarId.hasValue).toBe(false);
    });

    it('should emit AvatarChangedEvent with null', () => {
      const profile = createTestProfile();
      profile.changeAvatar(AvatarId.generate());
      profile.pullDomainEvents();

      profile.removeAvatar();

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AvatarChangedEvent);
      expect((events[0] as AvatarChangedEvent).avatarId).toBeNull();
    });
  });

  describe('updateLocation', () => {
    it('should change location', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      const location = Location.create({ city: 'Berlin', country: 'Germany' });
      profile.updateLocation(location);

      expect(profile.location.city).toBe('Berlin');
      expect(profile.location.country).toBe('Germany');
    });

    it('should emit ProfileUpdatedEvent with location change', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      profile.updateLocation(Location.create({ city: 'Berlin' }));

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect((events[0] as ProfileUpdatedEvent).changes).toEqual(['location']);
    });
  });

  describe('updatePrivacySettings', () => {
    it('should change privacy settings', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      const settings = PrivacySettings.create({
        profileVisibility: 'private',
        showEmail: true,
        showLocation: false,
      });
      profile.updatePrivacySettings(settings);

      expect(profile.privacySettings.profileVisibility).toBe('private');
      expect(profile.privacySettings.showEmail).toBe(true);
      expect(profile.privacySettings.showLocation).toBe(false);
    });

    it('should emit ProfileUpdatedEvent with privacySettings change', () => {
      const profile = createTestProfile();
      profile.pullDomainEvents();

      profile.updatePrivacySettings(
        PrivacySettings.create({
          profileVisibility: 'connections_only',
          showEmail: false,
          showLocation: false,
        }),
      );

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect((events[0] as ProfileUpdatedEvent).changes).toEqual([
        'privacySettings',
      ]);
    });
  });

  describe('isVisibleTo', () => {
    it('should be visible to owner regardless of settings', () => {
      const profile = createTestProfile();
      profile.updatePrivacySettings(
        PrivacySettings.create({
          profileVisibility: 'private',
          showEmail: false,
          showLocation: false,
        }),
      );

      const isVisible = profile.isVisibleTo(profile.memberId, false);

      expect(isVisible).toBe(true);
    });

    it('should be visible to everyone when public', () => {
      const profile = createTestProfile();
      // Default is public
      const stranger = UserId.generate();

      expect(profile.isVisibleTo(stranger, false)).toBe(true);
    });

    it('should be visible to connections when connections_only', () => {
      const profile = createTestProfile();
      profile.updatePrivacySettings(
        PrivacySettings.create({
          profileVisibility: 'connections_only',
          showEmail: false,
          showLocation: true,
        }),
      );

      const connection = UserId.generate();
      const stranger = UserId.generate();

      expect(profile.isVisibleTo(connection, true)).toBe(true);
      expect(profile.isVisibleTo(stranger, false)).toBe(false);
    });

    it('should not be visible to anyone else when private', () => {
      const profile = createTestProfile();
      profile.updatePrivacySettings(
        PrivacySettings.create({
          profileVisibility: 'private',
          showEmail: false,
          showLocation: false,
        }),
      );

      const connection = UserId.generate();
      const stranger = UserId.generate();

      expect(profile.isVisibleTo(connection, true)).toBe(false);
      expect(profile.isVisibleTo(stranger, false)).toBe(false);
    });
  });

  describe('domain events accumulation', () => {
    it('should accumulate multiple events across operations', () => {
      const profile = createTestProfile();
      // Already has ProfileCreatedEvent

      profile.updateDisplayName(DisplayName.create('New Name'));
      profile.updateBio(Bio.create('New bio'));
      profile.changeAvatar(AvatarId.generate());

      const events = profile.pullDomainEvents();
      expect(events).toHaveLength(4);
      expect(events[0]).toBeInstanceOf(ProfileCreatedEvent);
      expect(events[1]).toBeInstanceOf(ProfileUpdatedEvent);
      expect(events[2]).toBeInstanceOf(ProfileUpdatedEvent);
      expect(events[3]).toBeInstanceOf(AvatarChangedEvent);
    });

    it('should clear events after pull', () => {
      const profile = createTestProfile();
      profile.updateDisplayName(DisplayName.create('New Name'));

      const firstPull = profile.pullDomainEvents();
      expect(firstPull).toHaveLength(2);

      const secondPull = profile.pullDomainEvents();
      expect(secondPull).toHaveLength(0);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute without emitting events', () => {
      const id = ProfileId.generate();
      const memberId = UserId.generate();
      const displayName = DisplayName.create('Alice');
      const bio = Bio.create('Hello world');
      const avatarId = AvatarId.generate();
      const location = Location.create({ city: 'NYC', country: 'US' });
      const privacy = PrivacySettings.create({
        profileVisibility: 'connections_only',
        showEmail: true,
        showLocation: true,
      });
      const createdAt = Timestamp.now();
      const updatedAt = Timestamp.now();

      const profile = Profile.reconstitute(
        id,
        memberId,
        displayName,
        bio,
        avatarId,
        location,
        privacy,
        createdAt,
        updatedAt,
        5,
      );

      expect(profile.id.equals(id)).toBe(true);
      expect(profile.memberId.equals(memberId)).toBe(true);
      expect(profile.displayName.value).toBe('Alice');
      expect(profile.bio.value).toBe('Hello world');
      expect(profile.avatarId.value).toBe(avatarId.value);
      expect(profile.location.city).toBe('NYC');
      expect(profile.privacySettings.profileVisibility).toBe('connections_only');
      expect(profile.version).toBe(5);
      expect(profile.pullDomainEvents()).toHaveLength(0);
    });
  });
});
