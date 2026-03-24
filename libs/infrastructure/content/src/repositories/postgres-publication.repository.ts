import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  IPublicationRepository,
} from '@csn/domain-content';
import { BaseRepository } from '@csn/infra-shared';
import { PublicationEntity } from '../entities/publication.entity';
import { MentionEntity } from '../entities/mention.entity';
import { ReactionEntity } from '../entities/reaction.entity';
import {
  PublicationMapper,
  PublicationPersistenceBundle,
} from '../mappers/publication.mapper';

export class PostgresPublicationRepository
  extends BaseRepository<Publication, PublicationId, PublicationEntity>
  implements IPublicationRepository
{
  private readonly publicationMapper: PublicationMapper;
  private readonly mentionRepository: Repository<MentionEntity>;
  private readonly reactionRepository: Repository<ReactionEntity>;

  constructor(
    ormRepository: Repository<PublicationEntity>,
    mentionRepository: Repository<MentionEntity>,
    reactionRepository: Repository<ReactionEntity>,
  ) {
    const mapper = new PublicationMapper();
    // We pass a thin adapter to BaseRepository so findById/exists still work on the entity level.
    // The actual mapper used by BaseRepository only needs toPersistence to produce PublicationEntity.
    const entityMapper = {
      toDomain: (entity: PublicationEntity): Publication => {
        // Not used directly -- we override findById below.
        return mapper.toDomain({
          publication: entity,
          mentions: entity.mentions ?? [],
          reactions: entity.reactions ?? [],
        });
      },
      toPersistence: (domain: Publication): PublicationEntity => {
        return mapper.toPersistence(domain).publication;
      },
    };
    super(ormRepository, entityMapper);
    this.publicationMapper = mapper;
    this.mentionRepository = mentionRepository;
    this.reactionRepository = reactionRepository;
  }

  nextId(): PublicationId {
    return PublicationId.create(randomUUID());
  }

  protected idCondition(
    id: PublicationId,
  ): FindOptionsWhere<PublicationEntity> {
    return { id: id.value } as FindOptionsWhere<PublicationEntity>;
  }

  async findById(id: PublicationId): Promise<Publication | null> {
    const entity = await this.ormRepository.findOne({
      where: this.idCondition(id),
      relations: ['mentions', 'reactions'],
    });
    if (!entity) return null;
    return this.publicationMapper.toDomain({
      publication: entity,
      mentions: entity.mentions ?? [],
      reactions: entity.reactions ?? [],
    });
  }

  async save(aggregate: Publication): Promise<void> {
    // Delegate to BaseRepository.save() for atomic optimistic locking on the
    // publication entity. The entityMapper adapter (set up in the constructor)
    // extracts just the PublicationEntity from the bundle for persistence.
    await super.save(aggregate);

    // Replace mentions: delete existing, then bulk insert new ones.
    // This is done after the publication save so that a version conflict
    // aborts before touching mention data.
    const bundle = this.publicationMapper.toPersistence(aggregate);
    await this.mentionRepository.delete({
      publicationId: aggregate.id.value,
    } as FindOptionsWhere<MentionEntity>);

    if (bundle.mentions.length > 0) {
      await this.mentionRepository.save(bundle.mentions);
    }

    // Reactions are NOT replaced here -- they are managed individually
    // through dedicated addReaction/removeReaction operations.
    // The mapper's toPersistence intentionally returns empty reactions
    // to avoid accidentally deleting user-level reaction data.
  }

  async findByAuthorId(authorId: UserId): Promise<Publication[]> {
    const entities = await this.ormRepository.find({
      where: { authorId: authorId.value } as FindOptionsWhere<PublicationEntity>,
      relations: ['mentions', 'reactions'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) =>
      this.publicationMapper.toDomain({
        publication: entity,
        mentions: entity.mentions ?? [],
        reactions: entity.reactions ?? [],
      }),
    );
  }
}
