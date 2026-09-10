import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere, IsNull, SelectQueryBuilder } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  GroupId,
  IPublicationRepository,
  FeedPageOptions,
  FeedCursorPosition,
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

  async findAllPublished(): Promise<Publication[]> {
    const entities = await this.ormRepository.find({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        // Group posts stay inside their group and never surface on Explore.
        groupId: IsNull(),
      } as FindOptionsWhere<PublicationEntity>,
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

  async findFeedForAuthors(
    authorIds: UserId[],
    options: FeedPageOptions,
  ): Promise<Publication[]> {
    if (authorIds.length === 0) {
      return [];
    }

    const query = this.ormRepository
      .createQueryBuilder('publication')
      .leftJoinAndSelect('publication.mentions', 'mention')
      .leftJoinAndSelect('publication.reactions', 'reaction')
      .where('publication.status = :status', { status: 'PUBLISHED' })
      .andWhere('publication.groupId IS NULL')
      .andWhere('publication.authorId IN (:...authorIds)', {
        authorIds: authorIds.map((id) => id.value),
      });

    this.applyKeysetCursor(query, options.cursor ?? null);

    const entities = await query
      .orderBy('publication.createdAt', 'DESC')
      .addOrderBy('publication.id', 'DESC')
      .take(options.limit)
      .getMany();

    return entities.map((entity) => this.toDomainEntity(entity));
  }

  async findByGroupId(
    groupId: GroupId,
    options: FeedPageOptions,
  ): Promise<Publication[]> {
    const query = this.ormRepository
      .createQueryBuilder('publication')
      .leftJoinAndSelect('publication.mentions', 'mention')
      .leftJoinAndSelect('publication.reactions', 'reaction')
      .where('publication.status = :status', { status: 'PUBLISHED' })
      .andWhere('publication.groupId = :groupId', { groupId: groupId.value });

    this.applyKeysetCursor(query, options.cursor ?? null);

    const entities = await query
      .orderBy('publication.createdAt', 'DESC')
      .addOrderBy('publication.id', 'DESC')
      .take(options.limit)
      .getMany();

    return entities.map((entity) => this.toDomainEntity(entity));
  }

  /**
   * Keyset predicate matching the (created_at DESC, id DESC) ordering: take
   * rows strictly older than the cursor, plus rows sharing the timestamp whose
   * id sorts lower, so posts created in the same millisecond are never skipped
   * or repeated across pages.
   */
  private applyKeysetCursor(
    query: SelectQueryBuilder<PublicationEntity>,
    cursor: FeedCursorPosition | null,
  ): void {
    if (!cursor) {
      return;
    }
    query.andWhere(
      '(publication.createdAt < :cursorCreatedAt OR (publication.createdAt = :cursorCreatedAt AND publication.id < :cursorId))',
      { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
    );
  }

  private toDomainEntity(entity: PublicationEntity): Publication {
    return this.publicationMapper.toDomain({
      publication: entity,
      mentions: entity.mentions ?? [],
      reactions: entity.reactions ?? [],
    });
  }
}
