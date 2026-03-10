import { describe, it, expect } from 'vitest';
import { Timestamp } from '@csn/domain-shared';
import { Session, SessionId, MemberId } from '@csn/domain-identity';
import { SessionMapper } from '../mappers/session.mapper';
import { SessionEntity } from '../entities/session.entity';

describe('SessionMapper', () => {
  const mapper = new SessionMapper();

  const sessionIdStr = '660e8400-e29b-41d4-a716-446655440001';
  const memberIdStr = '550e8400-e29b-41d4-a716-446655440000';

  function createDomainSession(isRevoked = false): Session {
    return Session.reconstitute(
      SessionId.create(sessionIdStr),
      MemberId.create(memberIdStr),
      Timestamp.fromDate(new Date('2025-06-01T10:00:00Z')),
      Timestamp.fromDate(new Date('2025-06-08T10:00:00Z')),
      isRevoked,
      2,
    );
  }

  function createEntity(revokedAt: Date | null = null): SessionEntity {
    const entity = new SessionEntity();
    entity.id = sessionIdStr;
    entity.memberId = memberIdStr;
    entity.userAgent = 'Mozilla/5.0';
    entity.ipAddress = '192.168.1.1';
    entity.expiresAt = new Date('2025-06-08T10:00:00Z');
    entity.revokedAt = revokedAt;
    entity.createdAt = new Date('2025-06-01T10:00:00Z');
    entity.version = 2;
    return entity;
  }

  describe('toPersistence', () => {
    it('should map domain Session to SessionEntity', () => {
      const session = createDomainSession();
      const entity = mapper.toPersistence(session);

      expect(entity.id).toBe(sessionIdStr);
      expect(entity.memberId).toBe(memberIdStr);
      expect(entity.expiresAt).toEqual(new Date('2025-06-08T10:00:00Z'));
      expect(entity.revokedAt).toBeNull();
      expect(entity.createdAt).toEqual(new Date('2025-06-01T10:00:00Z'));
      expect(entity.version).toBe(2);
    });

    it('should set revokedAt when session is revoked', () => {
      const session = createDomainSession(true);
      const entity = mapper.toPersistence(session);

      expect(entity.revokedAt).not.toBeNull();
      expect(entity.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('toDomain', () => {
    it('should map SessionEntity to domain Session', () => {
      const entity = createEntity();
      const session = mapper.toDomain(entity);

      expect(session.id.value).toBe(sessionIdStr);
      expect(session.memberId.value).toBe(memberIdStr);
      expect(session.createdAt.value).toEqual(
        new Date('2025-06-01T10:00:00Z'),
      );
      expect(session.expiresAt.value).toEqual(
        new Date('2025-06-08T10:00:00Z'),
      );
      expect(session.isRevoked).toBe(false);
      expect(session.version).toBe(2);
    });

    it('should map revoked entity to revoked domain session', () => {
      const entity = createEntity(new Date('2025-06-03T12:00:00Z'));
      const session = mapper.toDomain(entity);

      expect(session.isRevoked).toBe(true);
    });
  });

  describe('round-trip', () => {
    it('toPersistence -> toDomain should produce equivalent aggregate', () => {
      const original = createDomainSession();
      const entity = mapper.toPersistence(original);
      const restored = mapper.toDomain(entity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.memberId.value).toBe(original.memberId.value);
      expect(restored.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(restored.expiresAt.value.getTime()).toBe(
        original.expiresAt.value.getTime(),
      );
      expect(restored.isRevoked).toBe(original.isRevoked);
      expect(restored.version).toBe(original.version);
    });

    it('round-trip preserves revoked state', () => {
      const original = createDomainSession(true);
      const entity = mapper.toPersistence(original);
      const restored = mapper.toDomain(entity);

      expect(restored.isRevoked).toBe(true);
    });

    it('toDomain -> toPersistence preserves core fields', () => {
      const original = createEntity();
      const domain = mapper.toDomain(original);
      const restored = mapper.toPersistence(domain);

      expect(restored.id).toBe(original.id);
      expect(restored.memberId).toBe(original.memberId);
      expect(restored.expiresAt.getTime()).toBe(original.expiresAt.getTime());
      expect(restored.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(restored.version).toBe(original.version);
    });
  });
});
