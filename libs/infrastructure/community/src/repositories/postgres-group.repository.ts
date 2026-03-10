import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import { Group, GroupId, IGroupRepository } from '@csn/domain-community';
import { BaseRepository } from '@csn/infra-shared';
import { GroupEntity } from '../entities/group.entity';
import { GroupMapper } from '../mappers/group.mapper';

export class PostgresGroupRepository
  extends BaseRepository<Group, GroupId, GroupEntity>
  implements IGroupRepository
{
  constructor(ormRepository: Repository<GroupEntity>) {
    super(ormRepository, new GroupMapper());
  }

  nextId(): GroupId {
    return GroupId.create(randomUUID());
  }

  protected idCondition(id: GroupId): FindOptionsWhere<GroupEntity> {
    return { id: id.value } as FindOptionsWhere<GroupEntity>;
  }

  async findByOwnerId(
    ownerId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Group>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where: { ownerId: ownerId.value } as FindOptionsWhere<GroupEntity>,
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
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

  async search(
    query: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Group>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where: [
        { name: ILike(`%${query}%`) } as FindOptionsWhere<GroupEntity>,
        { description: ILike(`%${query}%`) } as FindOptionsWhere<GroupEntity>,
      ],
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
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
}
