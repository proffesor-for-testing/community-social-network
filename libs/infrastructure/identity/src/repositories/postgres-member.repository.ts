import { Repository, FindOptionsWhere } from 'typeorm';
import { Email } from '@csn/domain-shared';
import { Member, MemberId, IMemberRepository } from '@csn/domain-identity';
import { BaseRepository } from '@csn/infra-shared';
import { MemberEntity } from '../entities/member.entity';
import { MemberMapper } from '../mappers/member.mapper';

export class PostgresMemberRepository
  extends BaseRepository<Member, MemberId, MemberEntity>
  implements IMemberRepository
{
  constructor(ormRepository: Repository<MemberEntity>) {
    super(ormRepository, new MemberMapper());
  }

  nextId(): MemberId {
    return MemberId.generate();
  }

  protected idCondition(id: MemberId): FindOptionsWhere<MemberEntity> {
    return { id: id.value } as FindOptionsWhere<MemberEntity>;
  }

  async findByEmail(email: Email): Promise<Member | null> {
    const entity = await this.ormRepository.findOne({
      where: { email: email.value } as FindOptionsWhere<MemberEntity>,
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }
}
