import { describe, it, expect } from 'vitest';
import { UserId, Timestamp, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';
import { Group } from '../aggregates/group';
import { GroupId } from '../value-objects/group-id';
import { GroupName } from '../value-objects/group-name';
import { GroupDescription } from '../value-objects/group-description';
import { GroupSettings } from '../value-objects/group-settings';
import { GroupRule } from '../value-objects/group-rule';
import { GroupStatus } from '../value-objects/group-status';
import { GroupCreatedEvent } from '../events/group-created.event';
import { GroupSettingsUpdatedEvent } from '../events/group-settings-updated.event';
import { OwnershipTransferredEvent } from '../events/ownership-transferred.event';
import { MaxRulesExceededError } from '../errors/max-rules-exceeded.error';

function createGroup(overrides?: {
  settings?: GroupSettings;
}): { group: Group; id: GroupId; ownerId: UserId } {
  const id = GroupId.generate();
  const ownerId = UserId.generate();
  const name = GroupName.create('Test Group');
  const description = GroupDescription.create('A test group description');
  const group = Group.create(id, name, description, ownerId, overrides?.settings);
  return { group, id, ownerId };
}

describe('Group Aggregate', () => {
  describe('create', () => {
    it('should create a group with default settings and emit GroupCreatedEvent', () => {
      const { group, id, ownerId } = createGroup();

      expect(group.id).toBe(id);
      expect(group.name.value).toBe('Test Group');
      expect(group.description.value).toBe('A test group description');
      expect(group.ownerId.value).toBe(ownerId.value);
      expect(group.status).toBe(GroupStatus.ACTIVE);
      expect(group.memberCount).toBe(0);
      expect(group.rules).toHaveLength(0);
      expect(group.settings.isPublic).toBe(true);
      expect(group.settings.requireApproval).toBe(false);
      expect(group.settings.allowMemberPosts).toBe(true);

      const events = group.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(GroupCreatedEvent);
      const event = events[0] as GroupCreatedEvent;
      expect(event.name).toBe('Test Group');
      expect(event.creatorId).toBe(ownerId.value);
      expect(event.aggregateType).toBe('Group');
      expect(event.eventType).toBe('GroupCreated');
    });

    it('should create a group with custom settings', () => {
      const settings = GroupSettings.create({
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: false,
      });
      const { group } = createGroup({ settings });

      expect(group.settings.isPublic).toBe(false);
      expect(group.settings.requireApproval).toBe(true);
      expect(group.settings.allowMemberPosts).toBe(false);
    });

    it('should start at version 1 after creation', () => {
      const { group } = createGroup();
      expect(group.version).toBe(1);
    });
  });

  describe('updateSettings', () => {
    it('should update settings and emit GroupSettingsUpdatedEvent', () => {
      const { group } = createGroup();
      group.pullDomainEvents(); // clear creation event

      const newSettings = GroupSettings.create({
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: false,
      });
      group.updateSettings(newSettings);

      expect(group.settings.isPublic).toBe(false);
      expect(group.settings.requireApproval).toBe(true);

      const events = group.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(GroupSettingsUpdatedEvent);
      const event = events[0] as GroupSettingsUpdatedEvent;
      expect(event.changes).toContain('isPublic');
      expect(event.changes).toContain('requireApproval');
      expect(event.changes).toContain('allowMemberPosts');
    });

    it('should not emit event when settings are unchanged', () => {
      const { group } = createGroup();
      group.pullDomainEvents();

      const sameSettings = GroupSettings.defaults();
      group.updateSettings(sameSettings);

      const events = group.pullDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('should throw when group is not ACTIVE', () => {
      const { group } = createGroup();
      group.archive();

      const newSettings = GroupSettings.create({
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: true,
      });

      expect(() => group.updateSettings(newSettings)).toThrow(ValidationError);
    });
  });

  describe('addRule / removeRule', () => {
    it('should add rules up to the limit', () => {
      const { group } = createGroup();

      for (let i = 0; i < CONTENT_LIMITS.MAX_GROUP_RULES; i++) {
        group.addRule(GroupRule.create(`Rule ${i + 1}`, `Description ${i + 1}`));
      }

      expect(group.rules).toHaveLength(CONTENT_LIMITS.MAX_GROUP_RULES);
    });

    it('should throw MaxRulesExceededError when limit reached', () => {
      const { group } = createGroup();

      for (let i = 0; i < CONTENT_LIMITS.MAX_GROUP_RULES; i++) {
        group.addRule(GroupRule.create(`Rule ${i + 1}`, `Description ${i + 1}`));
      }

      expect(() =>
        group.addRule(GroupRule.create('One Too Many', 'Should fail')),
      ).toThrow(MaxRulesExceededError);
    });

    it('should remove a rule by index', () => {
      const { group } = createGroup();
      group.addRule(GroupRule.create('Rule A', 'Desc A'));
      group.addRule(GroupRule.create('Rule B', 'Desc B'));
      group.addRule(GroupRule.create('Rule C', 'Desc C'));

      group.removeRule(1);

      expect(group.rules).toHaveLength(2);
      expect(group.rules[0].title).toBe('Rule A');
      expect(group.rules[1].title).toBe('Rule C');
    });

    it('should throw when removing out-of-bounds index', () => {
      const { group } = createGroup();
      group.addRule(GroupRule.create('Only Rule', 'Desc'));

      expect(() => group.removeRule(5)).toThrow(ValidationError);
      expect(() => group.removeRule(-1)).toThrow(ValidationError);
    });

    it('should throw when adding rule to non-ACTIVE group', () => {
      const { group } = createGroup();
      group.archive();

      expect(() =>
        group.addRule(GroupRule.create('Rule', 'Desc')),
      ).toThrow(ValidationError);
    });
  });

  describe('archive', () => {
    it('should change status to ARCHIVED', () => {
      const { group } = createGroup();
      group.archive();

      expect(group.status).toBe(GroupStatus.ARCHIVED);
    });

    it('should throw if already archived', () => {
      const { group } = createGroup();
      group.archive();

      expect(() => group.archive()).toThrow(ValidationError);
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership and emit OwnershipTransferredEvent', () => {
      const { group, ownerId } = createGroup();
      group.pullDomainEvents();

      const newOwnerId = UserId.generate();
      group.transferOwnership(newOwnerId);

      expect(group.ownerId.value).toBe(newOwnerId.value);

      const events = group.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OwnershipTransferredEvent);
      const event = events[0] as OwnershipTransferredEvent;
      expect(event.fromOwnerId).toBe(ownerId.value);
      expect(event.toOwnerId).toBe(newOwnerId.value);
    });

    it('should throw when group is not ACTIVE', () => {
      const { group } = createGroup();
      group.archive();

      expect(() => group.transferOwnership(UserId.generate())).toThrow(
        ValidationError,
      );
    });
  });

  describe('member count', () => {
    it('should increment member count', () => {
      const { group } = createGroup();
      group.incrementMemberCount();
      group.incrementMemberCount();

      expect(group.memberCount).toBe(2);
    });

    it('should decrement member count', () => {
      const { group } = createGroup();
      group.incrementMemberCount();
      group.incrementMemberCount();
      group.decrementMemberCount();

      expect(group.memberCount).toBe(1);
    });

    it('should not go below zero', () => {
      const { group } = createGroup();
      group.decrementMemberCount();

      expect(group.memberCount).toBe(0);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute without emitting events', () => {
      const id = GroupId.generate();
      const ownerId = UserId.generate();
      const name = GroupName.create('Restored Group');
      const description = GroupDescription.create('Restored');
      const settings = GroupSettings.defaults();
      const rules = [GroupRule.create('Rule 1', 'Desc')];
      const createdAt = Timestamp.now();

      const group = Group.reconstitute(
        id,
        name,
        description,
        ownerId,
        settings,
        rules,
        GroupStatus.ACTIVE,
        5,
        createdAt,
        3,
      );

      expect(group.id).toBe(id);
      expect(group.name.value).toBe('Restored Group');
      expect(group.memberCount).toBe(5);
      expect(group.version).toBe(3);
      expect(group.rules).toHaveLength(1);

      const events = group.pullDomainEvents();
      expect(events).toHaveLength(0);
    });
  });
});
