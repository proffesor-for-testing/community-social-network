import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  IPublicationRepository,
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
