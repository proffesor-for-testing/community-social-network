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
 * Uses Alert.reconstitute() for safe, compile-time-checked domain reconstruction.
 */
export class AlertMapper implements AggregateMapper<Alert, AlertEntity> {
  toDomain(raw: AlertEntity): Alert {
    return Alert.reconstitute(
      AlertId.create(raw.id),
      UserId.create(raw.recipientId),
      raw.type as AlertType,
      AlertContent.create(
        raw.title,
        raw.body,
        raw.actionUrl ?? undefined,
      ),
      raw.referenceId ?? '',
      Timestamp.fromDate(raw.createdAt),
      raw.status as AlertStatus,
      raw.readAt ? Timestamp.fromDate(raw.readAt) : null,
      raw.version,
    );
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
