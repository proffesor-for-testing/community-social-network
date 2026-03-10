import { describe, it, expect, beforeEach } from 'vitest';
import { Email, Timestamp } from '@csn/domain-shared';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { InMemoryMemberRepository } from '../repositories/in-memory-member.repository';

describe('InMemoryMemberRepository', () => {
  let repository: InMemoryMemberRepository;

  function createMember(overrides?: {
    id?: string;
    email?: string;
    displayName?: string;
  }): Member {
    return Member.reconstitute(
      MemberId.create(
        overrides?.id ?? '550e8400-e29b-41d4-a716-446655440000',
      ),
      Email.create(overrides?.email ?? 'alice@example.com'),
      Credential.create('$2b$10$hashedpassword'),
      MemberStatus.active(),
      overrides?.displayName ?? 'Alice',
      0,
      null,
      Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
      1,
    );
  }

  beforeEach(() => {
    repository = new InMemoryMemberRepository();
  });

  describe('nextId', () => {
    it('should generate a valid MemberId', () => {
      const id = repository.nextId();
      expect(id).toBeInstanceOf(MemberId);
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique ids', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save', () => {
    it('should store a member', async () => {
      const member = createMember();
      await repository.save(member);

      expect(repository.size).toBe(1);
    });

    it('should overwrite existing member with same id', async () => {
      const member = createMember();
      await repository.save(member);
      await repository.save(member);

      expect(repository.size).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return member when found', async () => {
      const member = createMember();
      await repository.save(member);

      const found = await repository.findById(member.id);
      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(member.id.value);
      expect(found!.email.value).toBe('alice@example.com');
    });

    it('should return null when not found', async () => {
      const id = MemberId.create('550e8400-e29b-41d4-a716-446655440099');
      const found = await repository.findById(id);
      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing member', async () => {
      const member = createMember();
      await repository.save(member);

      expect(await repository.exists(member.id)).toBe(true);
    });

    it('should return false for non-existing member', async () => {
      const id = MemberId.create('550e8400-e29b-41d4-a716-446655440099');
      expect(await repository.exists(id)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a member', async () => {
      const member = createMember();
      await repository.save(member);
      await repository.delete(member);

      expect(repository.size).toBe(0);
      expect(await repository.findById(member.id)).toBeNull();
    });

    it('should not throw when deleting non-existing member', async () => {
      const member = createMember();
      await expect(repository.delete(member)).resolves.not.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find member by email', async () => {
      const member = createMember({ email: 'bob@example.com' });
      await repository.save(member);

      const found = await repository.findByEmail(Email.create('bob@example.com'));
      expect(found).not.toBeNull();
      expect(found!.email.value).toBe('bob@example.com');
    });

    it('should return null when email not found', async () => {
      const found = await repository.findByEmail(
        Email.create('nobody@example.com'),
      );
      expect(found).toBeNull();
    });

    it('should find correct member among multiple', async () => {
      await repository.save(
        createMember({
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alice@example.com',
          displayName: 'Alice',
        }),
      );
      await repository.save(
        createMember({
          id: '550e8400-e29b-41d4-a716-446655440002',
          email: 'bob@example.com',
          displayName: 'Bob',
        }),
      );
      await repository.save(
        createMember({
          id: '550e8400-e29b-41d4-a716-446655440003',
          email: 'charlie@example.com',
          displayName: 'Charlie',
        }),
      );

      const found = await repository.findByEmail(
        Email.create('bob@example.com'),
      );
      expect(found).not.toBeNull();
      expect(found!.displayName).toBe('Bob');
    });
  });

  describe('clear', () => {
    it('should remove all members', async () => {
      await repository.save(
        createMember({
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'a@test.com',
        }),
      );
      await repository.save(
        createMember({
          id: '550e8400-e29b-41d4-a716-446655440002',
          email: 'b@test.com',
        }),
      );

      repository.clear();
      expect(repository.size).toBe(0);
    });
  });
});
