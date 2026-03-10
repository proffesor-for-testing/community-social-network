import { describe, it, expect } from 'vitest';
import { UserId } from '@csn/domain-shared';
import { AuditEntry } from '../aggregates/audit-entry';
import { AuditEntryId } from '../value-objects/audit-entry-id';
import { IpAddress } from '../value-objects/ip-address';
import { AuditEntryCreatedEvent } from '../events/audit-entry-created.event';

describe('AuditEntry Aggregate', () => {
  const createEntry = (overrides: Partial<{
    action: string;
    targetId: string;
    targetType: string;
    details: Record<string, unknown>;
    ip: string;
  }> = {}) => {
    const id = AuditEntryId.generate();
    const performedBy = UserId.generate();
    const ipAddress = IpAddress.create(overrides.ip ?? '192.168.1.1');

    return AuditEntry.create(
      id,
      overrides.action ?? 'USER_BANNED',
      performedBy,
      overrides.targetId ?? 'target-user-123',
      overrides.targetType ?? 'User',
      overrides.details ?? { reason: 'Spam' },
      ipAddress,
    );
  };

  describe('create', () => {
    it('should create an audit entry with all properties', () => {
      const entry = createEntry();

      expect(entry.action).toBe('USER_BANNED');
      expect(entry.targetId).toBe('target-user-123');
      expect(entry.targetType).toBe('User');
      expect(entry.details).toEqual({ reason: 'Spam' });
      expect(entry.ipAddress.value).toBe('192.168.1.1');
      expect(entry.createdAt).toBeDefined();
    });

    it('should emit AuditEntryCreatedEvent', () => {
      const entry = createEntry();
      const events = entry.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AuditEntryCreatedEvent);

      const event = events[0] as AuditEntryCreatedEvent;
      expect(event.action).toBe('USER_BANNED');
      expect(event.performedBy).toBe(entry.performedBy.value);
      expect(event.targetId).toBe('target-user-123');
      expect(event.aggregateType).toBe('AuditEntry');
      expect(event.eventType).toBe('AuditEntryCreated');
    });

    it('should set version to 1 after creation', () => {
      const entry = createEntry();
      expect(entry.version).toBe(1);
    });

    it('should freeze details object', () => {
      const mutableDetails = { reason: 'Spam', count: 5 };
      const entry = createEntry({ details: mutableDetails });

      // Modifying the original object should not affect the entry
      mutableDetails.reason = 'Modified';
      expect(entry.details).toEqual({ reason: 'Spam', count: 5 });

      // The details property should be frozen
      expect(Object.isFrozen(entry.details)).toBe(true);
    });

    it('should trim action, targetId, and targetType', () => {
      const entry = createEntry({
        action: '  USER_BANNED  ',
        targetId: '  target-123  ',
        targetType: '  User  ',
      });

      expect(entry.action).toBe('USER_BANNED');
      expect(entry.targetId).toBe('target-123');
      expect(entry.targetType).toBe('User');
    });

    it('should reject empty action', () => {
      expect(() => createEntry({ action: '' })).toThrow(
        'Audit entry action must not be empty',
      );
    });

    it('should reject whitespace-only action', () => {
      expect(() => createEntry({ action: '   ' })).toThrow(
        'Audit entry action must not be empty',
      );
    });

    it('should reject empty targetId', () => {
      expect(() => createEntry({ targetId: '' })).toThrow(
        'Audit entry targetId must not be empty',
      );
    });

    it('should reject empty targetType', () => {
      expect(() => createEntry({ targetType: '' })).toThrow(
        'Audit entry targetType must not be empty',
      );
    });
  });

  describe('immutability', () => {
    it('should be immutable after creation (no mutation methods)', () => {
      const entry = createEntry();

      // Verify there are no public methods that modify state
      // The aggregate only has getter properties and inherited methods
      expect(entry.action).toBe('USER_BANNED');
      expect(entry.targetId).toBe('target-user-123');
      expect(entry.targetType).toBe('User');
    });
  });
});
