import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Membership,
  MembershipId,
  GroupId,
  MembershipRole,
} from '@csn/domain-community';
import { MembershipMapper } from '../mappers/membership.mapper';
import { MembershipEntity } from '../entities/membership.entity';

describe('MembershipMapper', () => {
  const mapper = new MembershipMapper();

  function createTestMembership(): Membership {
    return Membership.reconstitute(
      MembershipId.create('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      GroupId.create('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      UserId.create('cccccccc-cccc-cccc-cccc-cccccccccccc'),
      MembershipRole.ADMIN,
      Timestamp.fromDate(new Date('2025-03-20T12:00:00.000Z')),
      5,
    );
  }

  function createTestEntity(): MembershipEntity {
    const entity = new MembershipEntity();
    entity.id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    entity.groupId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    entity.memberId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    entity.role = 'MODERATOR';
    entity.joinedAt = new Date('2025-05-01T08:30:00.000Z');
    entity.leftAt = null;
    entity.kickedAt = null;
    entity.kickedBy = null;
    entity.version = 2;
    return entity;
  }

  describe('toPersistence', () => {
    it('should map domain Membership to MembershipEntity', () => {
      const membership = createTestMembership();
      const entity = mapper.toPersistence(membership);

      expect(entity.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(entity.groupId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
      expect(entity.memberId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
      expect(entity.role).toBe('ADMIN');
      expect(entity.joinedAt).toEqual(new Date('2025-03-20T12:00:00.000Z'));
      expect(entity.leftAt).toBeNull();
      expect(entity.kickedAt).toBeNull();
      expect(entity.kickedBy).toBeNull();
      expect(entity.version).toBe(5);
    });
  });

  describe('toDomain', () => {
    it('should map MembershipEntity to domain Membership', () => {
      const entity = createTestEntity();
      const membership = mapper.toDomain(entity);

      expect(membership.id.value).toBe(
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
      );
      expect(membership.groupId.value).toBe(
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      );
      expect(membership.memberId.value).toBe(
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      );
      expect(membership.role).toBe(MembershipRole.MODERATOR);
      expect(membership.joinedAt.value).toEqual(
        new Date('2025-05-01T08:30:00.000Z'),
      );
      expect(membership.version).toBe(2);
    });
  });

  describe('round-trip', () => {
    it('should preserve all data through domain -> entity -> domain', () => {
      const original = createTestMembership();

      const entity = mapper.toPersistence(original);
      const restored = mapper.toDomain(entity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.groupId.value).toBe(original.groupId.value);
      expect(restored.memberId.value).toBe(original.memberId.value);
      expect(restored.role).toBe(original.role);
      expect(restored.joinedAt.value.getTime()).toBe(
        original.joinedAt.value.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('should preserve all data through entity -> domain -> entity', () => {
      const original = createTestEntity();

      const domain = mapper.toDomain(original);
      const restored = mapper.toPersistence(domain);

      expect(restored.id).toBe(original.id);
      expect(restored.groupId).toBe(original.groupId);
      expect(restored.memberId).toBe(original.memberId);
      expect(restored.role).toBe(original.role);
      expect(restored.joinedAt.getTime()).toBe(original.joinedAt.getTime());
      expect(restored.version).toBe(original.version);
    });

    it('should not emit domain events on reconstitution', () => {
      const entity = createTestEntity();
      const domain = mapper.toDomain(entity);

      const events = domain.pullDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('should map all MembershipRole values correctly', () => {
      const roles = [
        MembershipRole.OWNER,
        MembershipRole.ADMIN,
        MembershipRole.MODERATOR,
        MembershipRole.MEMBER,
      ];

      for (const role of roles) {
        const membership = Membership.reconstitute(
          MembershipId.create('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
          GroupId.create('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
          UserId.create('cccccccc-cccc-cccc-cccc-cccccccccccc'),
          role,
          Timestamp.fromDate(new Date('2025-01-01T00:00:00.000Z')),
          1,
        );

        const entity = mapper.toPersistence(membership);
        const restored = mapper.toDomain(entity);

        expect(restored.role).toBe(role);
      }
    });
  });
});
