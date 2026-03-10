import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Preference,
  PreferenceId,
  AlertType,
  DeliveryChannel,
} from '@csn/domain-notification';
import { PreferenceMapper } from '../mappers/preference.mapper';
import { PreferenceEntity } from '../entities/preference.entity';

describe('PreferenceMapper', () => {
  const mapper = new PreferenceMapper();

  const createDomainPreference = () => {
    const id = PreferenceId.generate();
    const memberId = UserId.generate();
    return Preference.create(id, memberId);
  };

  const createEntity = (
    overrides: Partial<PreferenceEntity> = {},
  ): PreferenceEntity => {
    const entity = new PreferenceEntity();
    entity.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    entity.memberId = 'f1e2d3c4-b5a6-7890-abcd-ef1234567890';
    entity.channelPreferences = {
      [AlertType.FOLLOW]: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      [AlertType.LIKE]: [DeliveryChannel.IN_APP],
      [AlertType.COMMENT]: [DeliveryChannel.IN_APP, DeliveryChannel.PUSH],
    };
    entity.mutedUntil = null;
    entity.version = 1;
    Object.assign(entity, overrides);
    return entity;
  };

  describe('toPersistence', () => {
    it('should map all domain fields to entity columns', () => {
      const preference = createDomainPreference();
      const entity = mapper.toPersistence(preference);

      expect(entity.id).toBe(preference.id.value);
      expect(entity.memberId).toBe(preference.memberId.value);
      expect(entity.version).toBe(1);
      expect(entity.mutedUntil).toBeNull();

      // Default preferences should include all AlertType values with IN_APP
      for (const alertType of Object.values(AlertType)) {
        expect(entity.channelPreferences[alertType]).toEqual([
          DeliveryChannel.IN_APP,
        ]);
      }
    });

    it('should serialize channelPreferences Map to plain object', () => {
      const preference = createDomainPreference();
      preference.setChannelsForType(AlertType.FOLLOW, [
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);

      const entity = mapper.toPersistence(preference);

      expect(entity.channelPreferences[AlertType.FOLLOW]).toEqual([
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);
    });

    it('should serialize mutedUntil when set', () => {
      const preference = createDomainPreference();
      const futureDate = new Date(Date.now() + 3600 * 1000);
      preference.mute(Timestamp.fromDate(futureDate));

      const entity = mapper.toPersistence(preference);

      expect(entity.mutedUntil).toBeInstanceOf(Date);
      expect(entity.mutedUntil!.getTime()).toBe(futureDate.getTime());
    });

    it('should set mutedUntil to null when not muted', () => {
      const preference = createDomainPreference();
      const entity = mapper.toPersistence(preference);

      expect(entity.mutedUntil).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('should map all entity columns to domain fields', () => {
      const entity = createEntity();
      const preference = mapper.toDomain(entity);

      expect(preference.id.value).toBe(entity.id);
      expect(preference.memberId.value).toBe(entity.memberId);
      expect(preference.version).toBe(1);
      expect(preference.mutedUntil).toBeNull();
    });

    it('should deserialize channelPreferences from jsonb to Map', () => {
      const entity = createEntity();
      const preference = mapper.toDomain(entity);

      expect(preference.getChannelsFor(AlertType.FOLLOW)).toEqual([
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);
      expect(preference.getChannelsFor(AlertType.LIKE)).toEqual([
        DeliveryChannel.IN_APP,
      ]);
      expect(preference.getChannelsFor(AlertType.COMMENT)).toEqual([
        DeliveryChannel.IN_APP,
        DeliveryChannel.PUSH,
      ]);
    });

    it('should handle mutedUntil timestamp', () => {
      const muteDate = new Date('2025-12-31T23:59:59.000Z');
      const entity = createEntity({ mutedUntil: muteDate });

      const preference = mapper.toDomain(entity);

      expect(preference.mutedUntil).not.toBeNull();
      expect(preference.mutedUntil!.value.toISOString()).toBe(
        '2025-12-31T23:59:59.000Z',
      );
    });

    it('should handle empty channelPreferences', () => {
      const entity = createEntity({ channelPreferences: {} });
      const preference = mapper.toDomain(entity);

      // Should fall back to default IN_APP for unknown types
      expect(preference.getChannelsFor(AlertType.FOLLOW)).toEqual([
        DeliveryChannel.IN_APP,
      ]);
    });

    it('should start with no pending domain events', () => {
      const entity = createEntity();
      const preference = mapper.toDomain(entity);

      expect(preference.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve all data through domain -> entity -> domain', () => {
      const original = createDomainPreference();
      original.setChannelsForType(AlertType.MENTION, [
        DeliveryChannel.EMAIL,
        DeliveryChannel.PUSH,
      ]);
      original.pullDomainEvents();

      const entity = mapper.toPersistence(original);
      const reconstituted = mapper.toDomain(entity);

      expect(reconstituted.id.value).toBe(original.id.value);
      expect(reconstituted.memberId.value).toBe(original.memberId.value);
      expect(reconstituted.version).toBe(original.version);
      expect(reconstituted.mutedUntil).toBeNull();

      // Check all channel preferences are preserved
      for (const alertType of Object.values(AlertType)) {
        expect(reconstituted.getChannelsFor(alertType)).toEqual(
          original.getChannelsFor(alertType),
        );
      }
    });

    it('should preserve mutedUntil through round-trip', () => {
      const original = createDomainPreference();
      const futureDate = new Date(Date.now() + 7200 * 1000);
      original.mute(Timestamp.fromDate(futureDate));
      original.pullDomainEvents();

      const entity = mapper.toPersistence(original);
      const reconstituted = mapper.toDomain(entity);

      expect(reconstituted.mutedUntil).not.toBeNull();
      expect(reconstituted.mutedUntil!.value.getTime()).toBe(
        original.mutedUntil!.value.getTime(),
      );
    });

    it('should preserve data through entity -> domain -> entity', () => {
      const originalEntity = createEntity();
      const domain = mapper.toDomain(originalEntity);
      const roundTrippedEntity = mapper.toPersistence(domain);

      expect(roundTrippedEntity.id).toBe(originalEntity.id);
      expect(roundTrippedEntity.memberId).toBe(originalEntity.memberId);
      expect(roundTrippedEntity.version).toBe(originalEntity.version);
      expect(roundTrippedEntity.mutedUntil).toBeNull();

      // Channel preferences should match
      for (const key of Object.keys(originalEntity.channelPreferences)) {
        expect(roundTrippedEntity.channelPreferences[key]).toEqual(
          originalEntity.channelPreferences[key],
        );
      }
    });
  });
});
