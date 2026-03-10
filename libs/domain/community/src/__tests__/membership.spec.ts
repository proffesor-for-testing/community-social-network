import { describe, it, expect } from 'vitest';
import { UserId, Timestamp, ValidationError } from '@csn/domain-shared';
import { Membership } from '../aggregates/membership';
import { MembershipId } from '../value-objects/membership-id';
import { GroupId } from '../value-objects/group-id';
import { MembershipRole } from '../value-objects/membership-role';
import { Permission } from '../value-objects/permission';
import { MemberJoinedGroupEvent } from '../events/member-joined-group.event';
import { MemberLeftGroupEvent } from '../events/member-left-group.event';
import { MemberPromotedEvent } from '../events/member-promoted.event';
import { MemberKickedEvent } from '../events/member-kicked.event';
import { CannotPromoteToOwnerError } from '../errors/cannot-promote-to-owner.error';

function createMembership(role: MembershipRole = MembershipRole.MEMBER): {
  membership: Membership;
  id: MembershipId;
  groupId: GroupId;
  memberId: UserId;
} {
  const id = MembershipId.generate();
  const groupId = GroupId.generate();
  const memberId = UserId.generate();
  const membership = Membership.create(id, groupId, memberId, role);
  return { membership, id, groupId, memberId };
}

describe('Membership Aggregate', () => {
  describe('create', () => {
    it('should create a membership and emit MemberJoinedGroupEvent', () => {
      const { membership, id, groupId, memberId } = createMembership();

      expect(membership.id).toBe(id);
      expect(membership.groupId.value).toBe(groupId.value);
      expect(membership.memberId.value).toBe(memberId.value);
      expect(membership.role).toBe(MembershipRole.MEMBER);

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberJoinedGroupEvent);
      const event = events[0] as MemberJoinedGroupEvent;
      expect(event.memberId).toBe(memberId.value);
      expect(event.role).toBe(MembershipRole.MEMBER);
      expect(event.aggregateType).toBe('Membership');
    });

    it('should start at version 1', () => {
      const { membership } = createMembership();
      expect(membership.version).toBe(1);
    });
  });

  describe('promote', () => {
    it('should promote MEMBER to MODERATOR', () => {
      const { membership, memberId } = createMembership(MembershipRole.MEMBER);
      membership.pullDomainEvents();

      membership.promote(MembershipRole.MODERATOR);

      expect(membership.role).toBe(MembershipRole.MODERATOR);

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberPromotedEvent);
      const event = events[0] as MemberPromotedEvent;
      expect(event.memberId).toBe(memberId.value);
      expect(event.fromRole).toBe(MembershipRole.MEMBER);
      expect(event.toRole).toBe(MembershipRole.MODERATOR);
    });

    it('should promote MEMBER to ADMIN', () => {
      const { membership } = createMembership(MembershipRole.MEMBER);
      membership.promote(MembershipRole.ADMIN);

      expect(membership.role).toBe(MembershipRole.ADMIN);
    });

    it('should promote MODERATOR to ADMIN', () => {
      const { membership } = createMembership(MembershipRole.MODERATOR);
      membership.promote(MembershipRole.ADMIN);

      expect(membership.role).toBe(MembershipRole.ADMIN);
    });

    it('should throw CannotPromoteToOwnerError when promoting to OWNER', () => {
      const { membership } = createMembership(MembershipRole.ADMIN);

      expect(() => membership.promote(MembershipRole.OWNER)).toThrow(
        CannotPromoteToOwnerError,
      );
    });

    it('should throw when promoting to same or lower role', () => {
      const { membership } = createMembership(MembershipRole.MODERATOR);

      expect(() => membership.promote(MembershipRole.MEMBER)).toThrow(
        ValidationError,
      );
      expect(() => membership.promote(MembershipRole.MODERATOR)).toThrow(
        ValidationError,
      );
    });
  });

  describe('demote', () => {
    it('should demote ADMIN to MODERATOR', () => {
      const { membership } = createMembership(MembershipRole.ADMIN);

      membership.demote(MembershipRole.MODERATOR);

      expect(membership.role).toBe(MembershipRole.MODERATOR);
    });

    it('should demote ADMIN to MEMBER', () => {
      const { membership } = createMembership(MembershipRole.ADMIN);

      membership.demote(MembershipRole.MEMBER);

      expect(membership.role).toBe(MembershipRole.MEMBER);
    });

    it('should demote MODERATOR to MEMBER', () => {
      const { membership } = createMembership(MembershipRole.MODERATOR);

      membership.demote(MembershipRole.MEMBER);

      expect(membership.role).toBe(MembershipRole.MEMBER);
    });

    it('should throw when demoting OWNER', () => {
      const { membership } = createMembership(MembershipRole.OWNER);

      expect(() => membership.demote(MembershipRole.ADMIN)).toThrow(
        ValidationError,
      );
    });

    it('should throw when demoting to same or higher role', () => {
      const { membership } = createMembership(MembershipRole.MODERATOR);

      expect(() => membership.demote(MembershipRole.ADMIN)).toThrow(
        ValidationError,
      );
      expect(() => membership.demote(MembershipRole.MODERATOR)).toThrow(
        ValidationError,
      );
    });
  });

  describe('leave', () => {
    it('should emit MemberLeftGroupEvent', () => {
      const { membership, memberId } = createMembership(MembershipRole.MEMBER);
      membership.pullDomainEvents();

      membership.leave();

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberLeftGroupEvent);
      const event = events[0] as MemberLeftGroupEvent;
      expect(event.memberId).toBe(memberId.value);
    });

    it('should throw when OWNER tries to leave', () => {
      const { membership } = createMembership(MembershipRole.OWNER);

      expect(() => membership.leave()).toThrow(ValidationError);
    });

    it('should allow ADMIN to leave', () => {
      const { membership } = createMembership(MembershipRole.ADMIN);
      membership.pullDomainEvents();

      membership.leave();

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberLeftGroupEvent);
    });
  });

  describe('kick', () => {
    it('should emit MemberKickedEvent', () => {
      const { membership, memberId } = createMembership(MembershipRole.MEMBER);
      membership.pullDomainEvents();

      const kickerId = UserId.generate().value;
      membership.kick(kickerId, 'Violated rules');

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberKickedEvent);
      const event = events[0] as MemberKickedEvent;
      expect(event.memberId).toBe(memberId.value);
      expect(event.kickedBy).toBe(kickerId);
      expect(event.reason).toBe('Violated rules');
    });

    it('should throw when kicking the OWNER', () => {
      const { membership } = createMembership(MembershipRole.OWNER);

      expect(() => membership.kick('someone', 'reason')).toThrow(
        ValidationError,
      );
    });
  });

  describe('hasPermission', () => {
    it('OWNER should have all permissions', () => {
      const { membership } = createMembership(MembershipRole.OWNER);

      expect(membership.hasPermission(Permission.MANAGE_MEMBERS)).toBe(true);
      expect(membership.hasPermission(Permission.MANAGE_SETTINGS)).toBe(true);
      expect(membership.hasPermission(Permission.MANAGE_RULES)).toBe(true);
      expect(membership.hasPermission(Permission.DELETE_POSTS)).toBe(true);
      expect(membership.hasPermission(Permission.PIN_POSTS)).toBe(true);
    });

    it('ADMIN should have all permissions', () => {
      const { membership } = createMembership(MembershipRole.ADMIN);

      expect(membership.hasPermission(Permission.MANAGE_MEMBERS)).toBe(true);
      expect(membership.hasPermission(Permission.MANAGE_SETTINGS)).toBe(true);
      expect(membership.hasPermission(Permission.MANAGE_RULES)).toBe(true);
      expect(membership.hasPermission(Permission.DELETE_POSTS)).toBe(true);
      expect(membership.hasPermission(Permission.PIN_POSTS)).toBe(true);
    });

    it('MODERATOR should have moderation permissions but not management', () => {
      const { membership } = createMembership(MembershipRole.MODERATOR);

      expect(membership.hasPermission(Permission.MANAGE_MEMBERS)).toBe(false);
      expect(membership.hasPermission(Permission.MANAGE_SETTINGS)).toBe(false);
      expect(membership.hasPermission(Permission.MANAGE_RULES)).toBe(true);
      expect(membership.hasPermission(Permission.DELETE_POSTS)).toBe(true);
      expect(membership.hasPermission(Permission.PIN_POSTS)).toBe(true);
    });

    it('MEMBER should have no management permissions', () => {
      const { membership } = createMembership(MembershipRole.MEMBER);

      expect(membership.hasPermission(Permission.MANAGE_MEMBERS)).toBe(false);
      expect(membership.hasPermission(Permission.MANAGE_SETTINGS)).toBe(false);
      expect(membership.hasPermission(Permission.MANAGE_RULES)).toBe(false);
      expect(membership.hasPermission(Permission.DELETE_POSTS)).toBe(false);
      expect(membership.hasPermission(Permission.PIN_POSTS)).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute without emitting events', () => {
      const id = MembershipId.generate();
      const groupId = GroupId.generate();
      const memberId = UserId.generate();
      const joinedAt = Timestamp.now();

      const membership = Membership.reconstitute(
        id,
        groupId,
        memberId,
        MembershipRole.ADMIN,
        joinedAt,
        5,
      );

      expect(membership.id).toBe(id);
      expect(membership.role).toBe(MembershipRole.ADMIN);
      expect(membership.version).toBe(5);

      const events = membership.pullDomainEvents();
      expect(events).toHaveLength(0);
    });
  });
});
