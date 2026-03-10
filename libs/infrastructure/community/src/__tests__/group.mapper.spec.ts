import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  GroupRule,
  GroupStatus,
} from '@csn/domain-community';
import { GroupMapper } from '../mappers/group.mapper';
import { GroupEntity } from '../entities/group.entity';

describe('GroupMapper', () => {
  const mapper = new GroupMapper();

  function createTestGroup(): Group {
    return Group.reconstitute(
      GroupId.create('11111111-1111-1111-1111-111111111111'),
      GroupName.create('Test Group'),
      GroupDescription.create('A description for testing'),
      UserId.create('22222222-2222-2222-2222-222222222222'),
      GroupSettings.create({
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: false,
      }),
      [
        GroupRule.create('Be kind', 'Treat everyone with respect'),
        GroupRule.create('No spam', 'Avoid spamming the group'),
      ],
      GroupStatus.ACTIVE,
      42,
      Timestamp.fromDate(new Date('2025-06-15T10:00:00.000Z')),
      7,
    );
  }

  function createTestEntity(): GroupEntity {
    const entity = new GroupEntity();
    entity.id = '33333333-3333-3333-3333-333333333333';
    entity.name = 'Entity Group';
    entity.description = 'Entity description';
    entity.ownerId = '44444444-4444-4444-4444-444444444444';
    entity.isPublic = true;
    entity.requireApproval = false;
    entity.allowMemberPosts = true;
    entity.rules = [{ title: 'Rule 1', description: 'First rule' }];
    entity.status = 'ARCHIVED';
    entity.memberCount = 10;
    entity.createdAt = new Date('2025-01-01T00:00:00.000Z');
    entity.updatedAt = new Date('2025-06-01T00:00:00.000Z');
    entity.version = 3;
    return entity;
  }

  describe('toPersistence', () => {
    it('should map domain Group to GroupEntity', () => {
      const group = createTestGroup();
      const entity = mapper.toPersistence(group);

      expect(entity.id).toBe('11111111-1111-1111-1111-111111111111');
      expect(entity.name).toBe('Test Group');
      expect(entity.description).toBe('A description for testing');
      expect(entity.ownerId).toBe('22222222-2222-2222-2222-222222222222');
      expect(entity.isPublic).toBe(false);
      expect(entity.requireApproval).toBe(true);
      expect(entity.allowMemberPosts).toBe(false);
      expect(entity.rules).toEqual([
        { title: 'Be kind', description: 'Treat everyone with respect' },
        { title: 'No spam', description: 'Avoid spamming the group' },
      ]);
      expect(entity.status).toBe('ACTIVE');
      expect(entity.memberCount).toBe(42);
      expect(entity.createdAt).toEqual(new Date('2025-06-15T10:00:00.000Z'));
      expect(entity.version).toBe(7);
    });
  });

  describe('toDomain', () => {
    it('should map GroupEntity to domain Group', () => {
      const entity = createTestEntity();
      const group = mapper.toDomain(entity);

      expect(group.id.value).toBe('33333333-3333-3333-3333-333333333333');
      expect(group.name.value).toBe('Entity Group');
      expect(group.description.value).toBe('Entity description');
      expect(group.ownerId.value).toBe('44444444-4444-4444-4444-444444444444');
      expect(group.settings.isPublic).toBe(true);
      expect(group.settings.requireApproval).toBe(false);
      expect(group.settings.allowMemberPosts).toBe(true);
      expect(group.rules).toHaveLength(1);
      expect(group.rules[0].title).toBe('Rule 1');
      expect(group.rules[0].description).toBe('First rule');
      expect(group.status).toBe(GroupStatus.ARCHIVED);
      expect(group.memberCount).toBe(10);
      expect(group.createdAt.value).toEqual(
        new Date('2025-01-01T00:00:00.000Z'),
      );
      expect(group.version).toBe(3);
    });

    it('should handle empty rules array', () => {
      const entity = createTestEntity();
      entity.rules = [];

      const group = mapper.toDomain(entity);
      expect(group.rules).toHaveLength(0);
    });

    it('should handle null rules as empty array', () => {
      const entity = createTestEntity();
      entity.rules = null as unknown as Array<{
        title: string;
        description: string;
      }>;

      const group = mapper.toDomain(entity);
      expect(group.rules).toHaveLength(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve all data through domain -> entity -> domain', () => {
      const original = createTestGroup();

      const entity = mapper.toPersistence(original);
      // Simulate DB by setting updatedAt
      entity.updatedAt = new Date();
      const restored = mapper.toDomain(entity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.name.value).toBe(original.name.value);
      expect(restored.description.value).toBe(original.description.value);
      expect(restored.ownerId.value).toBe(original.ownerId.value);
      expect(restored.settings.isPublic).toBe(original.settings.isPublic);
      expect(restored.settings.requireApproval).toBe(
        original.settings.requireApproval,
      );
      expect(restored.settings.allowMemberPosts).toBe(
        original.settings.allowMemberPosts,
      );
      expect(restored.rules).toHaveLength(original.rules.length);
      expect(restored.rules[0].title).toBe(original.rules[0].title);
      expect(restored.rules[0].description).toBe(
        original.rules[0].description,
      );
      expect(restored.rules[1].title).toBe(original.rules[1].title);
      expect(restored.status).toBe(original.status);
      expect(restored.memberCount).toBe(original.memberCount);
      expect(restored.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('should preserve all data through entity -> domain -> entity', () => {
      const original = createTestEntity();

      const domain = mapper.toDomain(original);
      const restored = mapper.toPersistence(domain);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.description).toBe(original.description);
      expect(restored.ownerId).toBe(original.ownerId);
      expect(restored.isPublic).toBe(original.isPublic);
      expect(restored.requireApproval).toBe(original.requireApproval);
      expect(restored.allowMemberPosts).toBe(original.allowMemberPosts);
      expect(restored.rules).toEqual(original.rules);
      expect(restored.status).toBe(original.status);
      expect(restored.memberCount).toBe(original.memberCount);
      expect(restored.createdAt.getTime()).toBe(
        original.createdAt.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('should not emit domain events on reconstitution', () => {
      const entity = createTestEntity();
      const domain = mapper.toDomain(entity);

      const events = domain.pullDomainEvents();
      expect(events).toHaveLength(0);
    });
  });
});
