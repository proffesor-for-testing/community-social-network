import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { AuditEntry, AuditEntryId, IpAddress } from '@csn/domain-admin';
import { AuditEntryMapper } from '../mappers/audit-entry.mapper';
import { AuditEntryEntity } from '../entities/audit-entry.entity';

describe('AuditEntryMapper', () => {
  const mapper = new AuditEntryMapper();

  const FIXED_ID = '550e8400-e29b-41d4-a716-446655440000';
  const FIXED_ACTOR_ID = '660e8400-e29b-41d4-a716-446655440001';
  const FIXED_TIMESTAMP = new Date('2025-03-10T12:00:00Z');

  function createDomainEntry(): AuditEntry {
    return AuditEntry.reconstitute(
      AuditEntryId.create(FIXED_ID),
      'USER_BANNED',
      UserId.create(FIXED_ACTOR_ID),
      'target-user-123',
      'User',
      { reason: 'Spam' },
      IpAddress.create('192.168.1.1'),
      Timestamp.fromDate(FIXED_TIMESTAMP),
      1,
    );
  }

  function createEntity(): AuditEntryEntity {
    const entity = new AuditEntryEntity();
    entity.id = FIXED_ID;
    entity.actorId = FIXED_ACTOR_ID;
    entity.action = 'USER_BANNED';
    entity.resource = 'User';
    entity.resourceId = 'target-user-123';
    entity.details = { reason: 'Spam' };
    entity.ipAddress = '192.168.1.1';
    entity.timestamp = FIXED_TIMESTAMP;
    entity.version = 1;
    return entity;
  }

  describe('toPersistence', () => {
    it('should map domain AuditEntry to AuditEntryEntity', () => {
      const entry = createDomainEntry();
      const entity = mapper.toPersistence(entry);

      expect(entity.id).toBe(FIXED_ID);
      expect(entity.actorId).toBe(FIXED_ACTOR_ID);
      expect(entity.action).toBe('USER_BANNED');
      expect(entity.resource).toBe('User');
      expect(entity.resourceId).toBe('target-user-123');
      expect(entity.details).toEqual({ reason: 'Spam' });
      expect(entity.ipAddress).toBe('192.168.1.1');
      expect(entity.timestamp).toEqual(FIXED_TIMESTAMP);
      expect(entity.version).toBe(1);
    });

    it('should map empty details correctly', () => {
      const entry = AuditEntry.reconstitute(
        AuditEntryId.create(FIXED_ID),
        'USER_VIEWED',
        UserId.create(FIXED_ACTOR_ID),
        'target-123',
        'User',
        {},
        IpAddress.create('10.0.0.1'),
        Timestamp.fromDate(FIXED_TIMESTAMP),
        1,
      );

      const entity = mapper.toPersistence(entry);
      expect(entity.details).toEqual({});
    });

    it('should map IPv6 address correctly', () => {
      const entry = AuditEntry.reconstitute(
        AuditEntryId.create(FIXED_ID),
        'LOGIN',
        UserId.create(FIXED_ACTOR_ID),
        'target-123',
        'Session',
        {},
        IpAddress.create('::1'),
        Timestamp.fromDate(FIXED_TIMESTAMP),
        1,
      );

      const entity = mapper.toPersistence(entry);
      expect(entity.ipAddress).toBe('::1');
    });
  });

  describe('toDomain', () => {
    it('should map AuditEntryEntity to domain AuditEntry', () => {
      const entity = createEntity();
      const entry = mapper.toDomain(entity);

      expect(entry.id.value).toBe(FIXED_ID);
      expect(entry.performedBy.value).toBe(FIXED_ACTOR_ID);
      expect(entry.action).toBe('USER_BANNED');
      expect(entry.targetType).toBe('User');
      expect(entry.targetId).toBe('target-user-123');
      expect(entry.details).toEqual({ reason: 'Spam' });
      expect(entry.ipAddress.value).toBe('192.168.1.1');
      expect(entry.createdAt.value).toEqual(FIXED_TIMESTAMP);
      expect(entry.version).toBe(1);
    });

    it('should handle empty details from entity', () => {
      const entity = createEntity();
      entity.details = {};

      const entry = mapper.toDomain(entity);
      expect(entry.details).toEqual({});
    });
  });

  describe('round-trip', () => {
    it('toPersistence -> toDomain should produce equivalent aggregate', () => {
      const original = createDomainEntry();
      const entity = mapper.toPersistence(original);
      const restored = mapper.toDomain(entity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.performedBy.value).toBe(original.performedBy.value);
      expect(restored.action).toBe(original.action);
      expect(restored.targetType).toBe(original.targetType);
      expect(restored.targetId).toBe(original.targetId);
      expect(restored.details).toEqual(original.details);
      expect(restored.ipAddress.value).toBe(original.ipAddress.value);
      expect(restored.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('toDomain -> toPersistence should produce equivalent entity', () => {
      const original = createEntity();
      const domain = mapper.toDomain(original);
      const restored = mapper.toPersistence(domain);

      expect(restored.id).toBe(original.id);
      expect(restored.actorId).toBe(original.actorId);
      expect(restored.action).toBe(original.action);
      expect(restored.resource).toBe(original.resource);
      expect(restored.resourceId).toBe(original.resourceId);
      expect(restored.details).toEqual(original.details);
      expect(restored.ipAddress).toBe(original.ipAddress);
      expect(restored.timestamp.getTime()).toBe(
        original.timestamp.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('round-trip with complex details preserves all fields', () => {
      const complexDetails = {
        reason: 'Policy violation',
        references: ['ref-1', 'ref-2'],
        metadata: { severity: 'high', count: 42 },
      };

      const entry = AuditEntry.reconstitute(
        AuditEntryId.create(FIXED_ID),
        'CONTENT_REMOVED',
        UserId.create(FIXED_ACTOR_ID),
        'post-456',
        'Post',
        complexDetails,
        IpAddress.create('192.168.1.100'),
        Timestamp.fromDate(FIXED_TIMESTAMP),
        1,
      );

      const entity = mapper.toPersistence(entry);
      const restored = mapper.toDomain(entity);

      expect(restored.details).toEqual(complexDetails);
    });
  });
});
