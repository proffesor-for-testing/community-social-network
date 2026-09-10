import { randomUUID } from 'crypto';
import { FindOptionsWhere } from 'typeorm';
import { Repository } from 'typeorm';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  IDiscussionRepository,
  DiscussionStatusEnum,
} from '@csn/domain-content';
import { BaseRepository } from '@csn/infra-shared';
import { DiscussionEntity } from '../entities/discussion.entity';
import { DiscussionMapper } from '../mappers/discussion.mapper';

export class PostgresDiscussionRepository
  extends BaseRepository<Discussion, DiscussionId, DiscussionEntity>
  implements IDiscussionRepository
{
  private readonly discussionMapper: DiscussionMapper;

  constructor(ormRepository: Repository<DiscussionEntity>) {
    const mapper = new DiscussionMapper();
    super(ormRepository, mapper);
    this.discussionMapper = mapper;
  }

  nextId(): DiscussionId {
    return DiscussionId.create(randomUUID());
  }

  protected idCondition(
    id: DiscussionId,
  ): FindOptionsWhere<DiscussionEntity> {
    return { id: id.value } as FindOptionsWhere<DiscussionEntity>;
  }

  async findByPublicationId(
    publicationId: PublicationId,
  ): Promise<Discussion[]> {
    const entities = await this.ormRepository.find({
      where: {
        publicationId: publicationId.value,
      } as FindOptionsWhere<DiscussionEntity>,
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => this.discussionMapper.toDomain(entity));
  }

  async countActiveByPublicationIds(
    publicationIds: PublicationId[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (publicationIds.length === 0) {
      return result;
    }
    const rows: { publicationId: string; count: string }[] = await this.ormRepository
      .createQueryBuilder('d')
      .select('d.publication_id', 'publicationId')
      .addSelect('COUNT(*)', 'count')
      .where('d.publication_id IN (:...ids)', { ids: publicationIds.map((id) => id.value) })
      .andWhere('d.status = :status', { status: DiscussionStatusEnum.ACTIVE })
      .groupBy('d.publication_id')
      .getRawMany();
    for (const row of rows) {
      result.set(row.publicationId, Number(row.count));
    }
    return result;
  }
}
