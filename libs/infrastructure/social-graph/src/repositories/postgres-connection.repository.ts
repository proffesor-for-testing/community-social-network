import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere } from 'typeorm';
import { BaseRepository } from '@csn/infra-shared';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  ConnectionStatusEnum,
  IConnectionRepository,
} from '@csn/domain-social-graph';
import { ConnectionEntity } from '../entities/connection.entity';
import { ConnectionMapper } from '../mappers/connection.mapper';

export class PostgresConnectionRepository
  extends BaseRepository<Connection, ConnectionId, ConnectionEntity>
  implements IConnectionRepository
{
  constructor(ormRepository: Repository<ConnectionEntity>) {
    super(ormRepository, new ConnectionMapper());
  }

  nextId(): ConnectionId {
    return ConnectionId.create(randomUUID());
  }

  protected idCondition(
    id: ConnectionId,
  ): FindOptionsWhere<ConnectionEntity> {
    return { id: id.value } as FindOptionsWhere<ConnectionEntity>;
  }

  async findByFollowerAndFollowee(
    followerId: UserId,
    followeeId: UserId,
  ): Promise<Connection | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        followerId: followerId.value,
        followeeId: followeeId.value,
      } as FindOptionsWhere<ConnectionEntity>,
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async findFollowers(userId: UserId): Promise<Connection[]> {
    const entities = await this.ormRepository.find({
      where: {
        followeeId: userId.value,
      } as FindOptionsWhere<ConnectionEntity>,
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findFollowing(userId: UserId): Promise<Connection[]> {
    const entities = await this.ormRepository.find({
      where: {
        followerId: userId.value,
      } as FindOptionsWhere<ConnectionEntity>,
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findAcceptedFolloweeIds(userId: UserId): Promise<UserId[]> {
    // Projection query: only the followee column is selected, so a member with
    // thousands of followees still costs one narrow scan per feed page.
    const rows = await this.ormRepository
      .createQueryBuilder('connection')
      .select('connection.followeeId', 'followeeId')
      .where('connection.followerId = :followerId', {
        followerId: userId.value,
      })
      .andWhere('connection.status = :status', {
        status: ConnectionStatusEnum.ACCEPTED,
      })
      .getRawMany<{ followeeId: string }>();

    return rows.map((row) => UserId.create(row.followeeId));
  }

  async countFollowers(userId: UserId): Promise<number> {
    return this.ormRepository.count({
      where: {
        followeeId: userId.value,
      } as FindOptionsWhere<ConnectionEntity>,
    });
  }

  async countFollowing(userId: UserId): Promise<number> {
    return this.ormRepository.count({
      where: {
        followerId: userId.value,
      } as FindOptionsWhere<ConnectionEntity>,
    });
  }
}
