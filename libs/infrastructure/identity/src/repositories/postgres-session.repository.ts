import { Repository, FindOptionsWhere, IsNull } from 'typeorm';
import { Session, SessionId, MemberId, ISessionRepository } from '@csn/domain-identity';
import { BaseRepository } from '@csn/infra-shared';
import { SessionEntity } from '../entities/session.entity';
import { SessionMapper } from '../mappers/session.mapper';
import { MoreThan } from 'typeorm';

export class PostgresSessionRepository
  extends BaseRepository<Session, SessionId, SessionEntity>
  implements ISessionRepository
{
  constructor(ormRepository: Repository<SessionEntity>) {
    super(ormRepository, new SessionMapper());
  }

  nextId(): SessionId {
    return SessionId.generate();
  }

  protected idCondition(id: SessionId): FindOptionsWhere<SessionEntity> {
    return { id: id.value } as FindOptionsWhere<SessionEntity>;
  }

  async findActiveByMemberId(memberId: MemberId): Promise<Session[]> {
    const entities = await this.ormRepository.find({
      where: {
        memberId: memberId.value,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      } as FindOptionsWhere<SessionEntity>,
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async countActiveByMemberId(memberId: MemberId): Promise<number> {
    return this.ormRepository.count({
      where: {
        memberId: memberId.value,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      } as FindOptionsWhere<SessionEntity>,
    });
  }
}
