import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
  AlertStatus,
} from '@csn/domain-notification';
import { AggregateMapper } from '@csn/infra-shared';
import { AlertEntity } from '../entities/alert.entity';

/**
 * Maps between the Alert domain aggregate and the AlertEntity persistence model.
 *
 * Because the Alert aggregate has a private constructor and does not yet expose
 * a static `reconstitute` factory, we use prototype-based reconstruction via
 * `Object.create`. This is a standard infrastructure-layer technique that avoids
 * modifying domain code while still correctly hydrating aggregates from storage.
 */
export class AlertMapper implements AggregateMapper<Alert, AlertEntity> {
  toDomain(raw: AlertEntity): Alert {
    const alert = Object.create(Alert.prototype) as Alert;

    // Hydrate private fields using indexed assignment.
    // Field names mirror the aggregate's private property names.
    const record = alert as Record<string, unknown>;
    record['_id'] = AlertId.create(raw.id);
    record['id'] = AlertId.create(raw.id);
    record['_recipientId'] = UserId.create(raw.recipientId);
    record['_type'] = raw.type as AlertType;
    record['_content'] = AlertContent.create(
      raw.title,
      raw.body,
      raw.actionUrl ?? undefined,
    );
    record['_status'] = raw.status as AlertStatus;
    record['_sourceId'] = raw.referenceId ?? '';
    record['_createdAt'] = Timestamp.fromDate(raw.createdAt);
    record['_readAt'] = raw.readAt ? Timestamp.fromDate(raw.readAt) : null;
    record['_domainEvents'] = [];
    record['_version'] = raw.version;

    return alert;
  }

  toPersistence(domain: Alert): AlertEntity {
    const entity = new AlertEntity();
    entity.id = domain.id.value;
    entity.recipientId = domain.recipientId.value;
    entity.type = domain.type as string;
    entity.title = domain.content.title;
    entity.body = domain.content.body;
    entity.actionUrl = domain.content.actionUrl ?? null;
    entity.status = domain.status as string;
    entity.referenceId = domain.sourceId || null;
    entity.createdAt = domain.createdAt.value;
    entity.readAt = domain.readAt ? domain.readAt.value : null;
    entity.dismissedAt =
      domain.status === AlertStatus.DISMISSED ? new Date() : null;
    entity.version = domain.version;
    return entity;
  }
}
