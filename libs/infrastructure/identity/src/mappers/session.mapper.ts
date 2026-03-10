import { Timestamp } from '@csn/domain-shared';
import { Session, SessionId, MemberId } from '@csn/domain-identity';
import { AggregateMapper } from '@csn/infra-shared';
import { SessionEntity } from '../entities/session.entity';

export class SessionMapper implements AggregateMapper<Session, SessionEntity> {
  toDomain(raw: SessionEntity): Session {
    const isRevoked = raw.revokedAt !== null;

    return Session.reconstitute(
      SessionId.create(raw.id),
      MemberId.create(raw.memberId),
      Timestamp.fromDate(raw.createdAt),
      Timestamp.fromDate(raw.expiresAt),
      isRevoked,
      raw.version,
    );
  }

  toPersistence(domain: Session): SessionEntity {
    const entity = new SessionEntity();
    entity.id = domain.id.value;
    entity.memberId = domain.memberId.value;
    entity.userAgent = '';
    entity.ipAddress = '';
    entity.expiresAt = domain.expiresAt.value;
    entity.revokedAt = domain.isRevoked ? new Date() : null;
    entity.createdAt = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}
