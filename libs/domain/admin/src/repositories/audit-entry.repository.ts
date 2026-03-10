import { IRepository, UserId, Timestamp, PaginatedResult, PaginationParams } from '@csn/domain-shared';
import { AuditEntry } from '../aggregates/audit-entry';
import { AuditEntryId } from '../value-objects/audit-entry-id';

export interface IAuditEntryRepository extends IRepository<AuditEntry, AuditEntryId> {
  findByPerformedBy(
    performedBy: UserId,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<AuditEntry>>;
  findByTargetId(
    targetId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<AuditEntry>>;
  findByDateRange(
    from: Timestamp,
    to: Timestamp,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<AuditEntry>>;
}
