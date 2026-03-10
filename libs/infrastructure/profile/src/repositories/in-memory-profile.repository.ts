import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { Profile, ProfileId, IProfileRepository } from '@csn/domain-profile';
import { ProfileMapper } from '../mappers/profile.mapper';
import { ProfileEntity } from '../entities/profile.entity';

/**
 * In-memory implementation of IProfileRepository for testing purposes.
 * Stores data as ProfileEntity records internally and maps through
 * the same ProfileMapper to ensure mapper correctness in tests.
 */
export class InMemoryProfileRepository implements IProfileRepository {
  private readonly store = new Map<string, ProfileEntity>();
  private readonly mapper = new ProfileMapper();

  nextId(): ProfileId {
    return ProfileId.create(randomUUID());
  }

  async findById(id: ProfileId): Promise<Profile | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async findByMemberId(memberId: UserId): Promise<Profile | null> {
    for (const entity of this.store.values()) {
      if (entity.memberId === memberId.value) {
        return this.mapper.toDomain(entity);
      }
    }
    return null;
  }

  async exists(id: ProfileId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Profile): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(entity.id, entity);
  }

  async delete(aggregate: Profile): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  /** Test helper: returns current store size. */
  get size(): number {
    return this.store.size;
  }

  /** Test helper: clears all stored entities. */
  clear(): void {
    this.store.clear();
  }
}
