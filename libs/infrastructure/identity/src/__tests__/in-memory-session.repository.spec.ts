import { describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from '@csn/domain-shared';
import { Session, SessionId, MemberId } from '@csn/domain-identity';
import { InMemorySessionRepository } from '../repositories/in-memory-session.repository';

describe('InMemorySessionRepository', () => {
  let repository: InMemorySessionRepository;

  const memberIdStr = '550e8400-e29b-41d4-a716-446655440000';
  const otherMemberIdStr = '550e8400-e29b-41d4-a716-446655440099';

  function createSession(overrides?: {
    id?: string;
    memberId?: string;
    isRevoked?: boolean;
    expiresAt?: Date;
  }): Session {
    return Session.reconstitute(
      SessionId.create(
        overrides?.id ?? '660e8400-e29b-41d4-a716-446655440001',
      ),
      MemberId.create(overrides?.memberId ?? memberIdStr),
      Timestamp.fromDate(new Date('2025-06-01T10:00:00Z')),
      Timestamp.fromDate(
        overrides?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ),
      overrides?.isRevoked ?? false,
      1,
    );
  }

  beforeEach(() => {
    repository = new InMemorySessionRepository();
  });

  describe('nextId', () => {
    it('should generate a valid SessionId', () => {
      const id = repository.nextId();
      expect(id).toBeInstanceOf(SessionId);
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
    it('should store a session', async () => {
      const session = createSession();
      await repository.save(session);

      expect(repository.size).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return session when found', async () => {
      const session = createSession();
      await repository.save(session);

      const found = await repository.findById(session.id);
      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(session.id.value);
    });

    it('should return null when not found', async () => {
      const id = SessionId.create('660e8400-e29b-41d4-a716-446655440099');
      const found = await repository.findById(id);
      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      const session = createSession();
      await repository.save(session);

      expect(await repository.exists(session.id)).toBe(true);
    });

    it('should return false for non-existing session', async () => {
      const id = SessionId.create('660e8400-e29b-41d4-a716-446655440099');
      expect(await repository.exists(id)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a session', async () => {
      const session = createSession();
      await repository.save(session);
      await repository.delete(session);

      expect(repository.size).toBe(0);
    });

    it('should not throw when deleting non-existing session', async () => {
      const session = createSession();
      await expect(repository.delete(session)).resolves.not.toThrow();
    });
  });

  describe('findActiveByMemberId', () => {
    it('should return active sessions for a member', async () => {
      const session = createSession({
        id: '660e8400-e29b-41d4-a716-446655440001',
      });
      await repository.save(session);

      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id.value).toBe(
        '660e8400-e29b-41d4-a716-446655440001',
      );
    });

    it('should exclude revoked sessions', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
          isRevoked: true,
        }),
      );

      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(0);
    });

    it('should exclude expired sessions', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
          expiresAt: new Date('2020-01-01T00:00:00Z'),
        }),
      );

      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(0);
    });

    it('should not return sessions from other members', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
          memberId: otherMemberIdStr,
        }),
      );

      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(0);
    });

    it('should return empty array when no sessions exist', async () => {
      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(0);
    });

    it('should return multiple active sessions', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
        }),
      );
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440002',
        }),
      );
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440003',
          isRevoked: true,
        }),
      );

      const results = await repository.findActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(results).toHaveLength(2);
    });
  });

  describe('countActiveByMemberId', () => {
    it('should return count of active sessions', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
        }),
      );
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440002',
        }),
      );
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440003',
          isRevoked: true,
        }),
      );

      const count = await repository.countActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(count).toBe(2);
    });

    it('should return 0 when no active sessions', async () => {
      const count = await repository.countActiveByMemberId(
        MemberId.create(memberIdStr),
      );
      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440001',
        }),
      );
      await repository.save(
        createSession({
          id: '660e8400-e29b-41d4-a716-446655440002',
        }),
      );

      repository.clear();
      expect(repository.size).toBe(0);
    });
  });
});
