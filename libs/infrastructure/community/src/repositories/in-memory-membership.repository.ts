import { randomUUID } from 'crypto';
import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import {
  Membership,
  MembershipId,
  GroupId,
  IMembershipRepository,
} from '@csn/domain-community';
import { MembershipMapper } from '../mappers/membership.mapper';
import { MembershipEntity } from '../entities/membership.entity';

/**
 * In-memory implementation of IMembershipRepository for unit testing.
 * Stores memberships via mapper round-trip to ensure mapper correctness is exercised.
 */
export class InMemoryMembershipRepository implements IMembershipRepository {
  private readonly store = new Map<string, MembershipEntity>();
  private readonly mapper = new MembershipMapper();

  nextId(): MembershipId {
    return MembershipId.create(randomUUID());
  }

  async findById(id: MembershipId): Promise<Membership | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: MembershipId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Membership): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(entity.id, entity);
  }

  async delete(aggregate: Membership): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByGroupId(
    groupId: GroupId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Membership>> {
    const all = Array.from(this.store.values())
      .filter((e) => e.groupId === groupId.value)
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

    return this.paginate(all, pagination);
  }

  async findByMemberId(
    memberId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Membership>> {
    const all = Array.from(this.store.values())
      .filter((e) => e.memberId === memberId.value)
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

    return this.paginate(all, pagination);
  }

  async findByGroupAndMember(
    groupId: GroupId,
    memberId: UserId,
  ): Promise<Membership | null> {
    const entity = Array.from(this.store.values()).find(
      (e) => e.groupId === groupId.value && e.memberId === memberId.value,
    );

    if (!entity) return null;
    return this.mapper.toDomain(entity);
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
    all: MembershipEntity[],
    pagination: PaginationParams,
  ): PaginatedResult<Membership> {
    const { page, pageSize } = pagination;
    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;
    const items = all
      .slice(skip, skip + pageSize)
      .map((e) => this.mapper.toDomain(e));

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
