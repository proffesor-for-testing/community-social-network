import { AggregateMapper } from '@csn/infra-shared';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  ConnectionStatus,
  ConnectionStatusEnum,
} from '@csn/domain-social-graph';
import { ConnectionEntity } from '../entities/connection.entity';

export class ConnectionMapper
  implements AggregateMapper<Connection, ConnectionEntity>
{
  toDomain(raw: ConnectionEntity): Connection {
    return Connection.reconstitute(
      ConnectionId.create(raw.id),
      UserId.create(raw.followerId),
      UserId.create(raw.followeeId),
      ConnectionStatus.create(raw.status as ConnectionStatusEnum),
      Timestamp.fromDate(raw.createdAt),
      raw.version,
    );
  }

  toPersistence(domain: Connection): ConnectionEntity {
    const entity = new ConnectionEntity();
    entity.id = domain.id.value;
    entity.followerId = domain.followerId.value;
    entity.followeeId = domain.followeeId.value;
    entity.status = domain.status.value;
    entity.createdAt = domain.createdAt.value;
    entity.updatedAt = new Date();
    entity.version = domain.version;
    return entity;
  }
}
