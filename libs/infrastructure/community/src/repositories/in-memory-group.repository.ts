import { randomUUID } from 'crypto';
import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import { Group, GroupId, IGroupRepository } from '@csn/domain-community';
import { GroupMapper } from '../mappers/group.mapper';
import { GroupEntity } from '../entities/group.entity';

/**
 * In-memory implementation of IGroupRepository for unit testing.
 * Stores groups via mapper round-trip to ensure mapper correctness is exercised.
 */
export class InMemoryGroupRepository implements IGroupRepository {
  private readonly store = new Map<string, GroupEntity>();
  private readonly mapper = new GroupMapper();

  nextId(): GroupId {
    return GroupId.create(randomUUID());
  }

  async findById(id: GroupId): Promise<Group | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: GroupId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Group): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(entity.id, entity);
  }

  async delete(aggregate: Group): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByOwnerId(
    ownerId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Group>> {
    const all = Array.from(this.store.values())
      .filter((e) => e.ownerId === ownerId.value)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return this.paginate(all, pagination);
  }

  async search(
    query: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Group>> {
    const lowerQuery = query.toLowerCase();
    const all = Array.from(this.store.values())
      .filter(
        (e) =>
          e.name.toLowerCase().includes(lowerQuery) ||
          e.description.toLowerCase().includes(lowerQuery),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return this.paginate(all, pagination);
  }

  /** Expose store size for test assertions. */
  get size(): number {
    return this.store.size;
  }

  /** Clear all stored entities. */
  clear(): void {
    this.store.clear();
  }

  private paginate(
    all: GroupEntity[],
    pagination: PaginationParams,
  ): PaginatedResult<Group> {
    const { page, pageSize } = pagination;
    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;
    const items = all.slice(skip, skip + pageSize).map((e) => this.mapper.toDomain(e));

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
