import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import { Profile, ProfileId, IProfileRepository } from '@csn/domain-profile';
import { BaseRepository } from '@csn/infra-shared';
import { ProfileEntity } from '../entities/profile.entity';
import { ProfileMapper } from '../mappers/profile.mapper';

export class PostgresProfileRepository
  extends BaseRepository<Profile, ProfileId, ProfileEntity>
  implements IProfileRepository
{
  constructor(ormRepository: Repository<ProfileEntity>) {
    super(ormRepository, new ProfileMapper());
  }

  nextId(): ProfileId {
    return ProfileId.create(randomUUID());
  }

  protected idCondition(
    id: ProfileId,
  ): FindOptionsWhere<ProfileEntity> {
    return { id: id.value } as FindOptionsWhere<ProfileEntity>;
  }

  async findByMemberId(memberId: UserId): Promise<Profile | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        memberId: memberId.value,
      } as FindOptionsWhere<ProfileEntity>,
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }
}
