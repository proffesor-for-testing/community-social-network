import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Membership,
  MembershipId,
  GroupId,
  MembershipRole,
} from '@csn/domain-community';
import { InMemoryMembershipRepository } from '../repositories/in-memory-membership.repository';

describe('InMemoryMembershipRepository', () => {
  let repository: InMemoryMembershipRepository;

  beforeEach(() => {
    repository = new InMemoryMembershipRepository();
  });

  function createMembership(overrides?: {
    groupId?: GroupId;
    memberId?: UserId;
    role?: MembershipRole;
  }): Membership {
    return Membership.create(
      repository.nextId(),
      overrides?.groupId ?? GroupId.generate(),
      overrides?.memberId ?? UserId.generate(),
      overrides?.role ?? MembershipRole.MEMBER,
    );
  }

  describe('nextId', () => {
    it('should generate unique MembershipIds', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
      expect(id1.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve a membership', async () => {
      const membership = createMembership();
      await repository.save(membership);

      const found = await repository.findById(membership.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(membership.id.value);
      expect(found!.groupId.value).toBe(membership.groupId.value);
      expect(found!.memberId.value).toBe(membership.memberId.value);
      expect(found!.role).toBe(MembershipRole.MEMBER);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(MembershipId.generate());
      expect(found).toBeNull();
    });

    it('should overwrite when saving with same id', async () => {
      const membership = createMembership();
      await repository.save(membership);

      // Promote and save again
      membership.promote(MembershipRole.MODERATOR);
      await repository.save(membership);

      const found = await repository.findById(membership.id);
      expect(found!.role).toBe(MembershipRole.MODERATOR);
      expect(repository.size).toBe(1);
    });
  });

  describe('exists', () => {
    it('should return true for saved membership', async () => {
      const membership = createMembership();
      await repository.save(membership);

      const result = await repository.exists(membership.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent membership', async () => {
      const result = await repository.exists(MembershipId.generate());
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a membership', async () => {
      const membership = createMembership();
      await repository.save(membership);

      await repository.delete(membership);

      const found = await repository.findById(membership.id);
      expect(found).toBeNull();
      expect(repository.size).toBe(0);
    });
  });

  describe('findByGroupId', () => {
    it('should return memberships for a specific group', async () => {
      const groupId = GroupId.generate();
      const m1 = createMembership({ groupId });
      const m2 = createMembership({ groupId });
      const otherMembership = createMembership();

      await repository.save(m1);
      await repository.save(m2);
      await repository.save(otherMembership);

      const result = await repository.findByGroupId(groupId);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(
        result.items.every((m) => m.groupId.value === groupId.value),
      ).toBe(true);
    });

    it('should return empty result for group with no members', async () => {
      const result = await repository.findByGroupId(GroupId.generate());

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should paginate results', async () => {
      const groupId = GroupId.generate();
      for (let i = 0; i < 5; i++) {
        await repository.save(createMembership({ groupId }));
      }

      const page1 = await repository.findByGroupId(groupId, {
        page: 1,
        pageSize: 2,
      });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);
    });
  });

  describe('findByMemberId', () => {
    it('should return memberships for a specific member', async () => {
      const memberId = UserId.generate();
      const m1 = createMembership({ memberId });
      const m2 = createMembership({ memberId });
      const otherMembership = createMembership();

      await repository.save(m1);
      await repository.save(m2);
      await repository.save(otherMembership);

      const result = await repository.findByMemberId(memberId);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(
        result.items.every((m) => m.memberId.value === memberId.value),
      ).toBe(true);
    });

    it('should return empty result for member with no memberships', async () => {
      const result = await repository.findByMemberId(UserId.generate());

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should paginate results', async () => {
      const memberId = UserId.generate();
      for (let i = 0; i < 4; i++) {
        await repository.save(createMembership({ memberId }));
      }

      const result = await repository.findByMemberId(memberId, {
        page: 2,
        pageSize: 2,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.page).toBe(2);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });
  });

  describe('findByGroupAndMember', () => {
    it('should find a membership by group and member', async () => {
      const groupId = GroupId.generate();
      const memberId = UserId.generate();
      const membership = createMembership({
        groupId,
        memberId,
        role: MembershipRole.ADMIN,
      });

      await repository.save(membership);

      const found = await repository.findByGroupAndMember(groupId, memberId);

      expect(found).not.toBeNull();
      expect(found!.groupId.value).toBe(groupId.value);
      expect(found!.memberId.value).toBe(memberId.value);
      expect(found!.role).toBe(MembershipRole.ADMIN);
    });

    it('should return null when no matching membership exists', async () => {
      const found = await repository.findByGroupAndMember(
        GroupId.generate(),
        UserId.generate(),
      );
      expect(found).toBeNull();
    });

    it('should return null for correct group but wrong member', async () => {
      const groupId = GroupId.generate();
      const membership = createMembership({ groupId });
      await repository.save(membership);

      const found = await repository.findByGroupAndMember(
        groupId,
        UserId.generate(),
      );
      expect(found).toBeNull();
    });

    it('should return null for correct member but wrong group', async () => {
      const memberId = UserId.generate();
      const membership = createMembership({ memberId });
      await repository.save(membership);

      const found = await repository.findByGroupAndMember(
        GroupId.generate(),
        memberId,
      );
      expect(found).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all stored memberships', async () => {
      await repository.save(createMembership());
      await repository.save(createMembership());
      expect(repository.size).toBe(2);

      repository.clear();
      expect(repository.size).toBe(0);
    });
  });
});
