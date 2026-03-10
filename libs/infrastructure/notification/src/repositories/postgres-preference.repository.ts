import { Repository, FindOptionsWhere } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import { Preference, PreferenceId, IPreferenceRepository } from '@csn/domain-notification';
import { BaseRepository } from '@csn/infra-shared';
import { PreferenceEntity } from '../entities/preference.entity';
import { PreferenceMapper } from '../mappers/preference.mapper';

export class PostgresPreferenceRepository
  extends BaseRepository<Preference, PreferenceId, PreferenceEntity>
  implements IPreferenceRepository
{
  constructor(ormRepository: Repository<PreferenceEntity>) {
    super(ormRepository, new PreferenceMapper());
  }

  nextId(): PreferenceId {
    return PreferenceId.generate();
  }

  protected idCondition(id: PreferenceId): FindOptionsWhere<PreferenceEntity> {
    return { id: id.value } as FindOptionsWhere<PreferenceEntity>;
  }

  async findByMemberId(memberId: UserId): Promise<Preference | null> {
    const entity = await this.ormRepository.findOne({
      where: { memberId: memberId.value } as FindOptionsWhere<PreferenceEntity>,
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }
}
