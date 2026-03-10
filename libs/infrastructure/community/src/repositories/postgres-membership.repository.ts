import { Repository, FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import {
  Membership,
  MembershipId,
  GroupId,
  IMembershipRepository,
} from '@csn/domain-community';
import { BaseRepository } from '@csn/infra-shared';
import { MembershipEntity } from '../entities/membership.entity';
import { MembershipMapper } from '../mappers/membership.mapper';

export class PostgresMembershipRepository
  extends BaseRepository<Membership, MembershipId, MembershipEntity>
  implements IMembershipRepository
{
  constructor(ormRepository: Repository<MembershipEntity>) {
    super(ormRepository, new MembershipMapper());
  }

  nextId(): MembershipId {
    return MembershipId.create(randomUUID());
  }

  protected idCondition(
    id: MembershipId,
  ): FindOptionsWhere<MembershipEntity> {
    return { id: id.value } as FindOptionsWhere<MembershipEntity>;
  }

  async findByGroupId(
    groupId: GroupId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Membership>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where: { groupId: groupId.value } as FindOptionsWhere<MembershipEntity>,
      skip,
      take: pageSize,
      order: { joinedAt: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
    });

    const items = entities.map((e) => this.mapper.toDomain(e));
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async findByMemberId(
    memberId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Membership>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where: {
        memberId: memberId.value,
      } as FindOptionsWhere<MembershipEntity>,
      skip,
      take: pageSize,
      order: { joinedAt: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
    });

    const items = entities.map((e) => this.mapper.toDomain(e));
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async findByGroupAndMember(
    groupId: GroupId,
    memberId: UserId,
  ): Promise<Membership | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        groupId: groupId.value,
        memberId: memberId.value,
      } as FindOptionsWhere<MembershipEntity>,
    });

    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }
}
