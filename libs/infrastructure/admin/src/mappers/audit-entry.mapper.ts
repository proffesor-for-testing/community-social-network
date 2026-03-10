import { UserId, Timestamp } from '@csn/domain-shared';
import { AuditEntry, AuditEntryId, IpAddress } from '@csn/domain-admin';
import { AggregateMapper } from '@csn/infra-shared';
import { AuditEntryEntity } from '../entities/audit-entry.entity';

export class AuditEntryMapper
  implements AggregateMapper<AuditEntry, AuditEntryEntity>
{
  toDomain(raw: AuditEntryEntity): AuditEntry {
    return AuditEntry.reconstitute(
      AuditEntryId.create(raw.id),
      raw.action,
      UserId.create(raw.actorId),
      raw.resourceId,
      raw.resource,
      raw.details,
      IpAddress.create(raw.ipAddress),
      Timestamp.fromDate(raw.timestamp),
      raw.version,
    );
  }

  toPersistence(domain: AuditEntry): AuditEntryEntity {
    const entity = new AuditEntryEntity();
    entity.id = domain.id.value;
    entity.actorId = domain.performedBy.value;
    entity.action = domain.action;
    entity.resource = domain.targetType;
    entity.resourceId = domain.targetId;
    entity.details = { ...domain.details };
    entity.ipAddress = domain.ipAddress.value;
    entity.timestamp = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}
