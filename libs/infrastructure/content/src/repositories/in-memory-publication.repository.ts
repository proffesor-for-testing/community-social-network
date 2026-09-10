import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  GroupId,
  IPublicationRepository,
  FeedPageOptions,
  FeedCursorPosition,
} from '@csn/domain-content';
import { OptimisticLockError } from '@csn/infra-shared';
import { PublicationMapper } from '../mappers/publication.mapper';
import { PublicationEntity } from '../entities/publication.entity';
import { MentionEntity } from '../entities/mention.entity';
import { ReactionEntity } from '../entities/reaction.entity';

export class InMemoryPublicationRepository implements IPublicationRepository {
  private readonly store = new Map<string, PublicationEntity>();
  private readonly mentionStore = new Map<string, MentionEntity[]>();
  private readonly reactionStore = new Map<string, ReactionEntity[]>();
  private readonly mapper = new PublicationMapper();

  nextId(): PublicationId {
    return PublicationId.create(randomUUID());
  }

  async findById(id: PublicationId): Promise<Publication | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain({
      publication: entity,
      mentions: this.mentionStore.get(id.value) ?? [],
      reactions: this.reactionStore.get(id.value) ?? [],
    });
  }

  async exists(id: PublicationId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Publication): Promise<void> {
    const currentVersion = aggregate.version;

    if (currentVersion > 1) {
      const existing = this.store.get(aggregate.id.value);
      if (existing && existing.version !== currentVersion - 1) {
        throw new OptimisticLockError(
          aggregate.constructor.name,
          aggregate.id.value,
        );
      }
    }

    const bundle = this.mapper.toPersistence(aggregate);
    this.store.set(aggregate.id.value, bundle.publication);
    this.mentionStore.set(aggregate.id.value, bundle.mentions);
    // Preserve existing reactions -- they are managed separately
    if (!this.reactionStore.has(aggregate.id.value)) {
      this.reactionStore.set(aggregate.id.value, []);
    }
  }

  async delete(aggregate: Publication): Promise<void> {
    this.store.delete(aggregate.id.value);
    this.mentionStore.delete(aggregate.id.value);
    this.reactionStore.delete(aggregate.id.value);
  }

  async findByAuthorId(authorId: UserId): Promise<Publication[]> {
    const results: Publication[] = [];
    for (const [pubId, entity] of this.store.entries()) {
      if (entity.authorId === authorId.value) {
        results.push(
          this.mapper.toDomain({
            publication: entity,
            mentions: this.mentionStore.get(pubId) ?? [],
            reactions: this.reactionStore.get(pubId) ?? [],
          }),
        );
      }
    }
    return results;
  }

  async findAllPublished(): Promise<Publication[]> {
    const results: Publication[] = [];
    for (const [pubId, entity] of this.store.entries()) {
      if (
        entity.status === 'PUBLISHED' &&
        entity.visibility === 'PUBLIC' &&
        // Group posts stay inside their group and never surface on Explore.
        !entity.groupId
      ) {
        results.push(
          this.mapper.toDomain({
            publication: entity,
            mentions: this.mentionStore.get(pubId) ?? [],
            reactions: this.reactionStore.get(pubId) ?? [],
          }),
        );
      }
    }
    return results.sort(
      (a, b) => b.createdAt.value.getTime() - a.createdAt.value.getTime(),
    );
  }

  async findFeedForAuthors(
    authorIds: UserId[],
    options: FeedPageOptions,
  ): Promise<Publication[]> {
    if (authorIds.length === 0) {
      return [];
    }
    const allowedAuthors = new Set(authorIds.map((id) => id.value));
    return this.paginate(
      (entity) =>
        entity.status === 'PUBLISHED' &&
        !entity.groupId &&
        allowedAuthors.has(entity.authorId),
      options,
    );
  }

  async findByGroupId(
    groupId: GroupId,
    options: FeedPageOptions,
  ): Promise<Publication[]> {
    return this.paginate(
      (entity) =>
        entity.status === 'PUBLISHED' && entity.groupId === groupId.value,
      options,
    );
  }

  /**
   * Shared keyset pagination over the in-memory store, mirroring the Postgres
   * ordering: (createdAt DESC, id DESC) with a strictly-after cursor.
   */
  private paginate(
    predicate: (entity: PublicationEntity) => boolean,
    options: FeedPageOptions,
  ): Publication[] {
    const matching = Array.from(this.store.values())
      .filter(predicate)
      .sort(compareNewestFirst);

    const start = cursorOffset(matching, options.cursor ?? null);
    return matching
      .slice(start, start + options.limit)
      .map((entity) => this.toDomain(entity));
  }

  private toDomain(entity: PublicationEntity): Publication {
    return this.mapper.toDomain({
      publication: entity,
      mentions: this.mentionStore.get(entity.id) ?? [],
      reactions: this.reactionStore.get(entity.id) ?? [],
    });
  }

  /** Test helper: clear all data */
  clear(): void {
    this.store.clear();
    this.mentionStore.clear();
    this.reactionStore.clear();
  }

  /** Test helper: get the count of stored publications */
  get size(): number {
    return this.store.size;
  }
}

/** Newest first, id descending as the tiebreaker — matches the SQL ORDER BY. */
function compareNewestFirst(a: PublicationEntity, b: PublicationEntity): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Index of the first row strictly after the cursor position. Rows sharing the
 * cursor's timestamp are only skipped when their id sorts at or above it, so a
 * page boundary inside a same-millisecond run neither drops nor repeats a post.
 */
function cursorOffset(
  ordered: PublicationEntity[],
  cursor: FeedCursorPosition | null,
): number {
  if (!cursor) {
    return 0;
  }
  const cursorTime = cursor.createdAt.getTime();
  const index = ordered.findIndex((entity) => {
    const time = entity.createdAt.getTime();
    if (time !== cursorTime) {
      return time < cursorTime;
    }
    return entity.id < cursor.id;
  });
  return index === -1 ? ordered.length : index;
}
