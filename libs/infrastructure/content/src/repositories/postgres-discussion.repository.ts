import { randomUUID } from 'crypto';
import { FindOptionsWhere } from 'typeorm';
import { Repository } from 'typeorm';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  IDiscussionRepository,
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
}
