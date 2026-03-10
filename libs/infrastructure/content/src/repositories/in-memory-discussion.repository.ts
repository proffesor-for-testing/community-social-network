import { randomUUID } from 'crypto';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  IDiscussionRepository,
} from '@csn/domain-content';
import { OptimisticLockError } from '@csn/infra-shared';
import { DiscussionMapper } from '../mappers/discussion.mapper';
import { DiscussionEntity } from '../entities/discussion.entity';

export class InMemoryDiscussionRepository implements IDiscussionRepository {
  private readonly store = new Map<string, DiscussionEntity>();
  private readonly mapper = new DiscussionMapper();

  nextId(): DiscussionId {
    return DiscussionId.create(randomUUID());
  }

  async findById(id: DiscussionId): Promise<Discussion | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: DiscussionId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Discussion): Promise<void> {
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

    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(aggregate.id.value, entity);
  }

  async delete(aggregate: Discussion): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByPublicationId(
    publicationId: PublicationId,
  ): Promise<Discussion[]> {
    const results: Discussion[] = [];
    for (const entity of this.store.values()) {
      if (entity.publicationId === publicationId.value) {
        results.push(this.mapper.toDomain(entity));
      }
    }
    return results;
  }

  /** Test helper: clear all data */
  clear(): void {
    this.store.clear();
  }

  /** Test helper: get the count of stored discussions */
  get size(): number {
    return this.store.size;
  }
}
