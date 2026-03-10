import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Preference,
  PreferenceId,
  AlertType,
  DeliveryChannel,
} from '@csn/domain-notification';
import { InMemoryPreferenceRepository } from '../repositories/in-memory-preference.repository';

describe('InMemoryPreferenceRepository', () => {
  let repository: InMemoryPreferenceRepository;

  const createPreference = (memberId?: UserId): Preference => {
    const id = PreferenceId.generate();
    const member = memberId ?? UserId.generate();
    return Preference.create(id, member);
  };

  beforeEach(() => {
    repository = new InMemoryPreferenceRepository();
  });

  describe('nextId', () => {
    it('should generate unique PreferenceId instances', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve a preference', async () => {
      const preference = createPreference();

      await repository.save(preference);
      const found = await repository.findById(preference.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(preference.id.value);
      expect(found!.memberId.value).toBe(preference.memberId.value);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(PreferenceId.generate());
      expect(found).toBeNull();
    });

    it('should overwrite on save with same id', async () => {
      const preference = createPreference();
      await repository.save(preference);

      preference.setChannelsForType(AlertType.FOLLOW, [
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);
      await repository.save(preference);

      const found = await repository.findById(preference.id);
      expect(found!.getChannelsFor(AlertType.FOLLOW)).toEqual([
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
      ]);
    });
  });

  describe('exists', () => {
    it('should return true for a saved preference', async () => {
      const preference = createPreference();
      await repository.save(preference);

      expect(await repository.exists(preference.id)).toBe(true);
    });

    it('should return false for a non-existent preference', async () => {
      expect(await repository.exists(PreferenceId.generate())).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a preference from the store', async () => {
      const preference = createPreference();
      await repository.save(preference);
      expect(repository.size).toBe(1);

      await repository.delete(preference);

      expect(repository.size).toBe(0);
      expect(await repository.findById(preference.id)).toBeNull();
    });
  });

  describe('findByMemberId', () => {
    it('should find preference by member id', async () => {
      const memberId = UserId.generate();
      const preference = createPreference(memberId);
      await repository.save(preference);

      const found = await repository.findByMemberId(memberId);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(preference.id.value);
      expect(found!.memberId.value).toBe(memberId.value);
    });

    it('should return null when member has no preferences', async () => {
      const found = await repository.findByMemberId(UserId.generate());
      expect(found).toBeNull();
    });

    it('should not return preferences of other members', async () => {
      const memberId1 = UserId.generate();
      const memberId2 = UserId.generate();
      const pref1 = createPreference(memberId1);
      const pref2 = createPreference(memberId2);
      await repository.save(pref1);
      await repository.save(pref2);

      const found = await repository.findByMemberId(memberId1);

      expect(found).not.toBeNull();
      expect(found!.memberId.value).toBe(memberId1.value);
    });
  });

  describe('muting behavior after save', () => {
    it('should preserve muted state after save and retrieval', async () => {
      const preference = createPreference();
      const futureDate = new Date(Date.now() + 3600 * 1000);
      preference.mute(Timestamp.fromDate(futureDate));

      await repository.save(preference);
      const found = await repository.findById(preference.id);

      expect(found!.isMuted()).toBe(true);
      expect(found!.mutedUntil).not.toBeNull();
    });

    it('should preserve unmuted state after save and retrieval', async () => {
      const preference = createPreference();
      const futureDate = new Date(Date.now() + 3600 * 1000);
      preference.mute(Timestamp.fromDate(futureDate));
      preference.unmute();

      await repository.save(preference);
      const found = await repository.findById(preference.id);

      expect(found!.isMuted()).toBe(false);
      expect(found!.mutedUntil).toBeNull();
    });
  });

  describe('channel preferences after save', () => {
    it('should preserve custom channel preferences after save', async () => {
      const preference = createPreference();
      preference.setChannelsForType(AlertType.MENTION, [
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
        DeliveryChannel.PUSH,
      ]);
      preference.setChannelsForType(AlertType.SYSTEM, []);

      await repository.save(preference);
      const found = await repository.findById(preference.id);

      expect(found!.getChannelsFor(AlertType.MENTION)).toEqual([
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
        DeliveryChannel.PUSH,
      ]);
      expect(found!.getChannelsFor(AlertType.SYSTEM)).toEqual([]);
      // Other types should keep defaults
      expect(found!.getChannelsFor(AlertType.LIKE)).toEqual([
        DeliveryChannel.IN_APP,
      ]);
    });
  });

  describe('test helpers', () => {
    it('should report correct size', async () => {
      expect(repository.size).toBe(0);

      await repository.save(createPreference());
      expect(repository.size).toBe(1);

      await repository.save(createPreference());
      expect(repository.size).toBe(2);
    });

    it('should clear all stored preferences', async () => {
      await repository.save(createPreference());
      await repository.save(createPreference());
      expect(repository.size).toBe(2);

      repository.clear();

      expect(repository.size).toBe(0);
    });
  });
});
