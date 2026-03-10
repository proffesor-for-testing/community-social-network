import { randomUUID } from 'crypto';
import { PaginatedResult, PaginationParams, DEFAULT_PAGINATION, UserId, Timestamp } from '@csn/domain-shared';
import { AuditEntry, AuditEntryId, IAuditEntryRepository } from '@csn/domain-admin';

export class InMemoryAuditEntryRepository implements IAuditEntryRepository {
  private readonly entries = new Map<string, AuditEntry>();

  nextId(): AuditEntryId {
    return AuditEntryId.create(randomUUID());
  }

  async findById(id: AuditEntryId): Promise<AuditEntry | null> {
    return this.entries.get(id.value) ?? null;
  }

  async exists(id: AuditEntryId): Promise<boolean> {
    return this.entries.has(id.value);
  }

  /**
   * Save enforces immutability: only new entries (version <= 1) can be saved.
   * Updates to existing entries are not allowed.
   */
  async save(aggregate: AuditEntry): Promise<void> {
    if (aggregate.version > 1) {
      throw new Error(
        'Audit entries are immutable and cannot be updated after creation.',
      );
    }

    if (this.entries.has(aggregate.id.value)) {
      throw new Error(
        'Audit entries are immutable and cannot be updated after creation.',
      );
    }

    this.entries.set(aggregate.id.value, aggregate);
  }

  /**
   * Delete is not allowed for audit entries.
   */
  async delete(_aggregate: AuditEntry): Promise<void> {
    throw new Error(
      'Audit entries are immutable and cannot be deleted.',
    );
  }

  async findByPerformedBy(
    performedBy: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    const matching = Array.from(this.entries.values()).filter(
      (entry) => entry.performedBy.value === performedBy.value,
    );
    return this.paginate(matching, pagination);
  }

  async findByTargetId(
    targetId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    const matching = Array.from(this.entries.values()).filter(
      (entry) => entry.targetId === targetId,
    );
    return this.paginate(matching, pagination);
  }

  async findByDateRange(
    from: Timestamp,
    to: Timestamp,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    const matching = Array.from(this.entries.values()).filter((entry) => {
      const ts = entry.createdAt.value.getTime();
      return ts >= from.value.getTime() && ts <= to.value.getTime();
    });
    return this.paginate(matching, pagination);
  }

  /**
   * Utility for tests: clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Utility for tests: return the count of stored entries.
   */
  count(): number {
    return this.entries.size;
  }

  private paginate(
    items: AuditEntry[],
    pagination: PaginationParams,
  ): PaginatedResult<AuditEntry> {
    const { page, pageSize } = pagination;
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;
    const paged = items.slice(skip, skip + pageSize);

    return {
      items: paged,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
