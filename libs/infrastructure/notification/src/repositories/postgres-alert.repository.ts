import { Repository, FindOptionsWhere } from 'typeorm';
import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import { Alert, AlertId, AlertStatus, IAlertRepository } from '@csn/domain-notification';
import { BaseRepository } from '@csn/infra-shared';
import { AlertEntity } from '../entities/alert.entity';
import { AlertMapper } from '../mappers/alert.mapper';

export class PostgresAlertRepository
  extends BaseRepository<Alert, AlertId, AlertEntity>
  implements IAlertRepository
{
  constructor(ormRepository: Repository<AlertEntity>) {
    super(ormRepository, new AlertMapper());
  }

  nextId(): AlertId {
    return AlertId.generate();
  }

  protected idCondition(id: AlertId): FindOptionsWhere<AlertEntity> {
    return { id: id.value } as FindOptionsWhere<AlertEntity>;
  }

  async findByRecipientId(
    recipientId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Alert>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where: {
        recipientId: recipientId.value,
      } as FindOptionsWhere<AlertEntity>,
      order: { createdAt: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
      skip,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: entities.map((e) => this.mapper.toDomain(e)),
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async countUnread(recipientId: UserId): Promise<number> {
    return this.ormRepository.count({
      where: {
        recipientId: recipientId.value,
        status: AlertStatus.UNREAD as string,
      } as FindOptionsWhere<AlertEntity>,
    });
  }
}
