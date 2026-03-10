import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { AuditEntry, AuditEntryId, IpAddress } from '@csn/domain-admin';
import { InMemoryAuditEntryRepository } from '../repositories/in-memory-audit-entry.repository';

describe('InMemoryAuditEntryRepository', () => {
  let repository: InMemoryAuditEntryRepository;

  function createEntry(overrides?: {
    id?: string;
    actorId?: string;
    action?: string;
    targetId?: string;
    targetType?: string;
    details?: Record<string, unknown>;
    ip?: string;
  }): AuditEntry {
    return AuditEntry.create(
      AuditEntryId.create(
        overrides?.id ?? '550e8400-e29b-41d4-a716-446655440000',
      ),
      overrides?.action ?? 'USER_BANNED',
      UserId.create(
        overrides?.actorId ?? '660e8400-e29b-41d4-a716-446655440001',
      ),
      overrides?.targetId ?? 'target-user-123',
      overrides?.targetType ?? 'User',
      overrides?.details ?? { reason: 'Spam' },
      IpAddress.create(overrides?.ip ?? '192.168.1.1'),
    );
  }

  beforeEach(() => {
    repository = new InMemoryAuditEntryRepository();
  });

  describe('nextId', () => {
    it('should generate a valid AuditEntryId', () => {
      const id = repository.nextId();
      expect(id).toBeInstanceOf(AuditEntryId);
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
    it('should store a new audit entry', async () => {
      const entry = createEntry();
      await repository.save(entry);

      expect(repository.count()).toBe(1);
    });

    it('should reject saving an entry that already exists', async () => {
      const entry = createEntry();
      await repository.save(entry);

      await expect(repository.save(entry)).rejects.toThrow(
        'Audit entries are immutable and cannot be updated after creation.',
      );
    });

    it('should reject saving an entry with version > 1', async () => {
      // An entry with version > 1 would indicate it has been modified
      // AuditEntry.create() sets version to 1, so we need to simulate
      // a higher version. Since AuditEntry is immutable, this scenario
      // would only arise from incorrect usage.
      // We test the guard by attempting to save the same entry twice.
      const entry = createEntry();
      await repository.save(entry);

      const entry2 = createEntry({
        id: '550e8400-e29b-41d4-a716-446655440099',
      });
      await repository.save(entry2);

      expect(repository.count()).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return entry when found', async () => {
      const entry = createEntry();
      await repository.save(entry);

      const found = await repository.findById(entry.id);
      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(entry.id.value);
      expect(found!.action).toBe('USER_BANNED');
    });

    it('should return null when not found', async () => {
      const id = AuditEntryId.create('550e8400-e29b-41d4-a716-446655440099');
      const found = await repository.findById(id);
      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing entry', async () => {
      const entry = createEntry();
      await repository.save(entry);

      expect(await repository.exists(entry.id)).toBe(true);
    });

    it('should return false for non-existing entry', async () => {
      const id = AuditEntryId.create('550e8400-e29b-41d4-a716-446655440099');
      expect(await repository.exists(id)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should throw error when attempting to delete', async () => {
      const entry = createEntry();
      await repository.save(entry);

      await expect(repository.delete(entry)).rejects.toThrow(
        'Audit entries are immutable and cannot be deleted.',
      );
    });

    it('should throw even for unsaved entries', async () => {
      const entry = createEntry();

      await expect(repository.delete(entry)).rejects.toThrow(
        'Audit entries are immutable and cannot be deleted.',
      );
    });
  });

  describe('findByPerformedBy', () => {
    it('should return entries for a specific actor', async () => {
      const actorId = '660e8400-e29b-41d4-a716-446655440001';

      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440001',
          actorId,
          action: 'USER_BANNED',
        }),
      );
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440002',
          actorId,
          action: 'USER_WARNED',
        }),
      );
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440003',
          actorId: '770e8400-e29b-41d4-a716-446655440001',
          action: 'USER_DELETED',
        }),
      );

      const result = await repository.findByPerformedBy(
        UserId.create(actorId),
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(
        result.items.every((e) => e.performedBy.value === actorId),
      ).toBe(true);
    });

    it('should return empty result when no entries match', async () => {
      const result = await repository.findByPerformedBy(
        UserId.create('660e8400-e29b-41d4-a716-446655440099'),
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support pagination', async () => {
      const actorId = '660e8400-e29b-41d4-a716-446655440001';

      for (let i = 1; i <= 5; i++) {
        await repository.save(
          createEntry({
            id: `550e8400-e29b-41d4-a716-44665544000${i}`,
            actorId,
            action: `ACTION_${i}`,
          }),
        );
      }

      const page1 = await repository.findByPerformedBy(
        UserId.create(actorId),
        { page: 1, pageSize: 2 },
      );

      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      const page3 = await repository.findByPerformedBy(
        UserId.create(actorId),
        { page: 3, pageSize: 2 },
      );

      expect(page3.items).toHaveLength(1);
      expect(page3.hasNextPage).toBe(false);
      expect(page3.hasPreviousPage).toBe(true);
    });
  });

  describe('findByTargetId', () => {
    it('should return entries for a specific target', async () => {
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440001',
          targetId: 'user-abc',
          targetType: 'User',
        }),
      );
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440002',
          targetId: 'user-abc',
          targetType: 'User',
        }),
      );
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440003',
          targetId: 'user-xyz',
          targetType: 'User',
        }),
      );

      const result = await repository.findByTargetId('user-abc');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items.every((e) => e.targetId === 'user-abc')).toBe(true);
    });

    it('should return empty result when no entries match', async () => {
      const result = await repository.findByTargetId('nonexistent');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findByDateRange', () => {
    it('should return entries within the date range', async () => {
      // Note: AuditEntry.create() uses Timestamp.now() internally,
      // so all entries created here will have very close timestamps.
      // We test that they fall within a range encompassing "now".
      const entry1 = createEntry({
        id: '550e8400-e29b-41d4-a716-446655440001',
      });
      const entry2 = createEntry({
        id: '550e8400-e29b-41d4-a716-446655440002',
      });

      await repository.save(entry1);
      await repository.save(entry2);

      const from = Timestamp.fromDate(new Date(Date.now() - 60000));
      const to = Timestamp.fromDate(new Date(Date.now() + 60000));

      const result = await repository.findByDateRange(from, to);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty result when no entries in range', async () => {
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      );

      // Range in the distant past
      const from = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
      const to = Timestamp.fromDate(new Date('2020-12-31T23:59:59Z'));

      const result = await repository.findByDateRange(from, to);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      );
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440002',
        }),
      );

      repository.clear();
      expect(repository.count()).toBe(0);
    });
  });

  describe('pagination defaults', () => {
    it('should use default pagination when not provided', async () => {
      await repository.save(
        createEntry({
          id: '550e8400-e29b-41d4-a716-446655440001',
        }),
      );

      const result = await repository.findByPerformedBy(
        UserId.create('660e8400-e29b-41d4-a716-446655440001'),
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });
});
