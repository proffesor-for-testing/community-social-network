import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Preference } from '../aggregates/preference';
import { PreferenceId } from '../value-objects/preference-id';
import { AlertType } from '../value-objects/alert-type';
import { DeliveryChannel } from '../value-objects/delivery-channel';
import { PreferencesUpdatedEvent } from '../events/preferences-updated.event';

describe('Preference Aggregate', () => {
  const createPreference = () => {
    const id = PreferenceId.generate();
    const memberId = UserId.generate();
    return Preference.create(id, memberId);
  };

  describe('create', () => {
    it('should create with default IN_APP channel for all alert types', () => {
      const preference = createPreference();

      for (const alertType of Object.values(AlertType)) {
        const channels = preference.getChannelsFor(alertType);
        expect(channels).toEqual([DeliveryChannel.IN_APP]);
      }
    });

    it('should not be muted by default', () => {
      const preference = createPreference();
      expect(preference.isMuted()).toBe(false);
      expect(preference.mutedUntil).toBeNull();
    });

    it('should have version 1 after creation', () => {
      const preference = createPreference();
      expect(preference.version).toBe(1);
    });
  });

  describe('setChannelsForType', () => {
    it('should set channels for a specific alert type', () => {
      const preference = createPreference();

      preference.setChannelsForType(AlertType.FOLLOW, [
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);

      const channels = preference.getChannelsFor(AlertType.FOLLOW);
      expect(channels).toEqual([DeliveryChannel.IN_APP, DeliveryChannel.EMAIL]);
    });

    it('should emit PreferencesUpdatedEvent', () => {
      const preference = createPreference();
      preference.pullDomainEvents(); // clear

      preference.setChannelsForType(AlertType.COMMENT, [DeliveryChannel.PUSH]);

      const events = preference.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PreferencesUpdatedEvent);

      const event = events[0] as PreferencesUpdatedEvent;
      expect(event.channels).toEqual(['PUSH']);
      expect(event.aggregateType).toBe('Preference');
      expect(event.eventType).toBe('PreferencesUpdated');
    });

    it('should increment version', () => {
      const preference = createPreference();
      expect(preference.version).toBe(1);

      preference.setChannelsForType(AlertType.LIKE, [DeliveryChannel.EMAIL]);
      expect(preference.version).toBe(2);
    });

    it('should not affect other alert type channels', () => {
      const preference = createPreference();

      preference.setChannelsForType(AlertType.FOLLOW, [DeliveryChannel.EMAIL, DeliveryChannel.PUSH]);

      expect(preference.getChannelsFor(AlertType.LIKE)).toEqual([DeliveryChannel.IN_APP]);
      expect(preference.getChannelsFor(AlertType.COMMENT)).toEqual([DeliveryChannel.IN_APP]);
    });

    it('should allow setting empty channels array', () => {
      const preference = createPreference();

      preference.setChannelsForType(AlertType.SYSTEM, []);

      expect(preference.getChannelsFor(AlertType.SYSTEM)).toEqual([]);
    });

    it('should return a copy of channels, not the internal array', () => {
      const preference = createPreference();
      preference.setChannelsForType(AlertType.MENTION, [DeliveryChannel.IN_APP]);

      const channels = preference.getChannelsFor(AlertType.MENTION);
      channels.push(DeliveryChannel.EMAIL);

      expect(preference.getChannelsFor(AlertType.MENTION)).toEqual([DeliveryChannel.IN_APP]);
    });
  });

  describe('mute/unmute', () => {
    it('should mute until a future timestamp', () => {
      const preference = createPreference();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const until = Timestamp.fromDate(futureDate);

      preference.mute(until);

      expect(preference.isMuted()).toBe(true);
      expect(preference.mutedUntil).not.toBeNull();
    });

    it('should not be muted when mute time has passed', () => {
      const preference = createPreference();
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const until = Timestamp.fromDate(pastDate);

      preference.mute(until);

      expect(preference.isMuted()).toBe(false);
    });

    it('should unmute', () => {
      const preference = createPreference();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      preference.mute(Timestamp.fromDate(futureDate));
      expect(preference.isMuted()).toBe(true);

      preference.unmute();

      expect(preference.isMuted()).toBe(false);
      expect(preference.mutedUntil).toBeNull();
    });

    it('should increment version on mute', () => {
      const preference = createPreference();
      const versionBefore = preference.version;
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      preference.mute(Timestamp.fromDate(futureDate));

      expect(preference.version).toBe(versionBefore + 1);
    });

    it('should increment version on unmute', () => {
      const preference = createPreference();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      preference.mute(Timestamp.fromDate(futureDate));
      const versionBefore = preference.version;

      preference.unmute();

      expect(preference.version).toBe(versionBefore + 1);
    });
  });

  describe('getChannelsFor', () => {
    it('should return default IN_APP for unknown alert type', () => {
      const preference = createPreference();
      // Cast to test fallback behavior for a type not in the map
      const channels = preference.getChannelsFor('UNKNOWN_TYPE' as AlertType);
      expect(channels).toEqual([DeliveryChannel.IN_APP]);
    });
  });

  describe('channelPreferences', () => {
    it('should return a copy of the preferences map', () => {
      const preference = createPreference();
      const map = preference.channelPreferences;
      map.set(AlertType.FOLLOW, [DeliveryChannel.PUSH]);

      // Internal state should not be affected
      expect(preference.getChannelsFor(AlertType.FOLLOW)).toEqual([DeliveryChannel.IN_APP]);
    });
  });
});
