# ADR-010: Repository Pattern Implementation

**Status**: Accepted
**Date**: 2025-12-16
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-006 (DDD Architecture), ADR-007 (Bounded Contexts), ADR-008 (Aggregates)

## Context

With aggregates defined (ADR-008), we need a consistent approach to persistence that:

1. **Maintains Domain Purity**: Domain layer has no infrastructure dependencies
2. **Supports Multiple Storage**: PostgreSQL for persistence, Redis for caching
3. **Handles Performance**: Meet p95 < 500ms targets with 3-tier caching
4. **Manages Transactions**: Aggregate-level transactions with optimistic locking
5. **Enables Testing**: Domain logic testable without database

Technical constraints from architecture specifications:
- PostgreSQL 15+ as primary database
- Redis 7+ for caching (85-90% cache hit rate target)
- TypeORM as ORM framework
- Connection pool limits (20 connections)

## Decision

We adopt the **Repository Pattern** with strict separation between domain interfaces and infrastructure implementations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Repository Pattern Architecture                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            DOMAIN LAYER                                      │
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │     Aggregate Root      │    │   Repository Interface  │                 │
│  │                         │    │                         │                 │
│  │  - Member               │    │  interface MemberRepo   │                 │
│  │  - Profile              │◄───│    nextId(): MemberId   │                 │
│  │  - Publication          │    │    save(m: Member)      │                 │
│  │  - etc.                 │    │    findById(id): Member │                 │
│  │                         │    │                         │                 │
│  └─────────────────────────┘    └─────────────────────────┘                 │
│                                              ▲                               │
│                                              │                               │
│                                              │ implements                    │
└──────────────────────────────────────────────┼──────────────────────────────┘
                                               │
┌──────────────────────────────────────────────┼──────────────────────────────┐
│                       INFRASTRUCTURE LAYER   │                               │
│                                              │                               │
│  ┌───────────────────────────────────────────▼───────────────────────────┐  │
│  │                    Repository Implementation                          │  │
│  │                                                                       │  │
│  │  PostgresMemberRepository implements MemberRepository                 │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │  │
│  │  │     Mapper      │    │   Cache Layer   │    │    TypeORM      │   │  │
│  │  │                 │    │                 │    │                 │   │  │
│  │  │ toDomain()      │    │ Redis 3-tier:   │    │ EntityManager   │   │  │
│  │  │ toPersistence() │    │ Memory→Redis→DB │    │ QueryBuilder    │   │  │
│  │  │                 │    │                 │    │                 │   │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Repository Design Principles

1. **One Repository per Aggregate Root**: Only aggregate roots have repositories
2. **Collection-Like Interface**: Repositories act like in-memory collections
3. **Explicit ID Generation**: `nextId()` method for creating IDs before save
4. **Domain Events Collection**: Repository publishes events after successful save
5. **Optimistic Locking**: Version-based concurrency control

---

### Repository Interface Contracts

#### Base Repository Interface

```typescript
// src/domain/shared/repositories/Repository.ts

export interface Repository<T, ID> {
  /**
   * Generate a new unique identifier for the aggregate.
   * Call this before creating a new aggregate instance.
   */
  nextId(): ID;

  /**
   * Persist an aggregate (create or update).
   * Publishes domain events after successful save.
   * @throws OptimisticLockError if version conflict
   */
  save(aggregate: T): Promise<void>;

  /**
   * Find aggregate by its unique identifier.
   * Returns null if not found.
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Check if an aggregate with the given ID exists.
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Remove an aggregate from persistence.
   * Soft delete by default (marks as deleted).
   */
  delete(aggregate: T): Promise<void>;
}
```

#### Context-Specific Repository Interfaces

```typescript
// src/domain/identity/repositories/MemberRepository.ts

export interface MemberRepository extends Repository<Member, MemberId> {
  /**
   * Find member by email (unique constraint).
   */
  findByEmail(email: Email): Promise<Member | null>;

  /**
   * Check if email is already registered.
   */
  emailExists(email: Email): Promise<boolean>;
}

// src/domain/profile/repositories/ProfileRepository.ts

export interface ProfileRepository extends Repository<Profile, ProfileId> {
  /**
   * Find profile by member ID (1:1 relationship).
   */
  findByMemberId(memberId: MemberId): Promise<Profile | null>;
}

// src/domain/content/repositories/PublicationRepository.ts

export interface PublicationRepository extends Repository<Publication, PublicationId> {
  /**
   * Find publications by author with pagination.
   */
  findByAuthor(
    authorId: MemberId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Publication>>;

  /**
   * Find publications for feed (followers' posts).
   * Excludes blocked users' content.
   */
  findForFeed(
    memberId: MemberId,
    blockedUserIds: MemberId[],
    options: PaginationOptions
  ): Promise<PaginatedResult<Publication>>;
}

// src/domain/content/repositories/DiscussionRepository.ts

export interface DiscussionRepository extends Repository<Discussion, DiscussionId> {
  /**
   * Find all discussions for a publication as a tree.
   * Uses materialized path for efficient loading.
   */
  findByPublication(publicationId: PublicationId): Promise<Discussion[]>;

  /**
   * Find direct replies to a discussion.
   */
  findReplies(parentId: DiscussionId): Promise<Discussion[]>;
}

// src/domain/social-graph/repositories/ConnectionRepository.ts

export interface ConnectionRepository extends Repository<Connection, ConnectionId> {
  /**
   * Check if a connection exists between two members.
   */
  existsBetween(followerId: MemberId, followingId: MemberId): Promise<boolean>;

  /**
   * Find connection by follower and following.
   */
  findByPair(
    followerId: MemberId,
    followingId: MemberId
  ): Promise<Connection | null>;

  /**
   * Get all followers of a member.
   */
  findFollowers(
    memberId: MemberId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Connection>>;

  /**
   * Get all members a user is following.
   */
  findFollowing(
    memberId: MemberId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Connection>>;

  /**
   * Get pending follow requests for a member.
   */
  findPendingRequests(memberId: MemberId): Promise<Connection[]>;
}

// src/domain/social-graph/repositories/BlockRepository.ts

export interface BlockRepository extends Repository<Block, BlockId> {
  /**
   * Check if member A has blocked member B.
   */
  isBlocked(blockerId: MemberId, blockedId: MemberId): Promise<boolean>;

  /**
   * Check bidirectional block (either direction).
   */
  hasBlockBetween(memberA: MemberId, memberB: MemberId): Promise<boolean>;

  /**
   * Get all members blocked by a user.
   */
  findBlockedBy(blockerId: MemberId): Promise<Block[]>;

  /**
   * Get IDs of all blocked members (for feed filtering).
   */
  getBlockedIds(memberId: MemberId): Promise<MemberId[]>;
}

// src/domain/community/repositories/GroupRepository.ts

export interface GroupRepository extends Repository<Group, GroupId> {
  /**
   * Find group by unique name.
   */
  findByName(name: GroupName): Promise<Group | null>;

  /**
   * Search groups by keyword.
   */
  search(
    keyword: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Group>>;
}

// src/domain/community/repositories/MembershipRepository.ts

export interface MembershipRepository extends Repository<Membership, MembershipId> {
  /**
   * Find membership for specific member in group.
   */
  findByMemberAndGroup(
    memberId: MemberId,
    groupId: GroupId
  ): Promise<Membership | null>;

  /**
   * Get all memberships for a member.
   */
  findByMember(
    memberId: MemberId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Membership>>;

  /**
   * Get all members of a group.
   */
  findByGroup(
    groupId: GroupId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Membership>>;

  /**
   * Get members with specific role in group.
   */
  findByGroupAndRole(
    groupId: GroupId,
    role: MembershipRole
  ): Promise<Membership[]>;
}

// src/domain/notification/repositories/AlertRepository.ts

export interface AlertRepository extends Repository<Alert, AlertId> {
  /**
   * Find unread alerts for member.
   */
  findUnread(
    recipientId: MemberId,
    options: PaginationOptions
  ): Promise<PaginatedResult<Alert>>;

  /**
   * Count unread alerts.
   */
  countUnread(recipientId: MemberId): Promise<number>;

  /**
   * Mark all alerts as read for member.
   */
  markAllRead(recipientId: MemberId): Promise<void>;
}
```

---

### Repository Implementation Pattern

#### Base Implementation with Caching

```typescript
// src/infrastructure/shared/repositories/BaseRepository.ts

export abstract class BaseRepository<T extends AggregateRoot, ID, Entity>
  implements Repository<T, ID> {

  constructor(
    protected readonly entityManager: EntityManager,
    protected readonly cacheService: CacheService,
    protected readonly eventPublisher: EventPublisher,
    protected readonly mapper: AggregateMapper<T, Entity>
  ) {}

  abstract get entityClass(): EntityTarget<Entity>;
  abstract get cachePrefix(): string;
  abstract get cacheTTL(): number;

  nextId(): ID {
    return this.generateId() as ID;
  }

  protected abstract generateId(): unknown;

  async save(aggregate: T): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);

    await this.entityManager.transaction(async (manager) => {
      // Optimistic locking check
      const existing = await manager.findOne(this.entityClass, {
        where: { id: (entity as any).id } as any,
        lock: { mode: 'optimistic', version: aggregate.version },
      });

      if (existing && existing.version !== aggregate.version) {
        throw new OptimisticLockError(aggregate.id);
      }

      // Save entity
      await manager.save(this.entityClass, entity);

      // Invalidate cache
      await this.invalidateCache(aggregate.id);
    });

    // Publish domain events after successful transaction
    const events = aggregate.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }

  async findById(id: ID): Promise<T | null> {
    // Check cache first
    const cached = await this.getFromCache(id);
    if (cached) {
      return cached;
    }

    // Query database
    const entity = await this.entityManager.findOne(this.entityClass, {
      where: { id: id as any } as any,
    });

    if (!entity) {
      return null;
    }

    const aggregate = this.mapper.toDomain(entity);

    // Cache result
    await this.setInCache(id, aggregate);

    return aggregate;
  }

  async exists(id: ID): Promise<boolean> {
    const count = await this.entityManager.count(this.entityClass, {
      where: { id: id as any } as any,
    });
    return count > 0;
  }

  async delete(aggregate: T): Promise<void> {
    // Soft delete by default
    await this.entityManager.update(
      this.entityClass,
      { id: aggregate.id as any },
      { deletedAt: new Date() } as any
    );

    await this.invalidateCache(aggregate.id);

    const events = aggregate.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }

  // Cache helpers
  protected async getFromCache(id: ID): Promise<T | null> {
    const key = `${this.cachePrefix}:${id}`;
    const data = await this.cacheService.get(key);
    if (!data) return null;
    return this.mapper.toDomain(data as Entity);
  }

  protected async setInCache(id: ID, aggregate: T): Promise<void> {
    const key = `${this.cachePrefix}:${id}`;
    const entity = this.mapper.toPersistence(aggregate);
    await this.cacheService.set(key, entity, this.cacheTTL);
  }

  protected async invalidateCache(id: unknown): Promise<void> {
    const key = `${this.cachePrefix}:${id}`;
    await this.cacheService.delete(key);
  }
}
```

#### Concrete Implementation Example

```typescript
// src/infrastructure/identity/repositories/PostgresMemberRepository.ts

import { EntityManager } from 'typeorm';
import { MemberEntity } from '../entities/MemberEntity';
import { Member, MemberId, Email } from '../../../domain/identity';
import { MemberRepository } from '../../../domain/identity/repositories/MemberRepository';
import { MemberMapper } from '../mappers/MemberMapper';

export class PostgresMemberRepository
  extends BaseRepository<Member, MemberId, MemberEntity>
  implements MemberRepository {

  get entityClass() { return MemberEntity; }
  get cachePrefix() { return 'member'; }
  get cacheTTL() { return 3600; } // 1 hour

  protected generateId(): MemberId {
    return MemberId.generate();
  }

  async findByEmail(email: Email): Promise<Member | null> {
    // Check cache by email
    const cacheKey = `member:email:${email.normalized}`;
    const cachedId = await this.cacheService.get<string>(cacheKey);

    if (cachedId) {
      return this.findById(MemberId.from(cachedId));
    }

    // Query database
    const entity = await this.entityManager.findOne(MemberEntity, {
      where: { email: email.normalized },
    });

    if (!entity) {
      return null;
    }

    const member = this.mapper.toDomain(entity);

    // Cache by ID and email
    await this.setInCache(member.id, member);
    await this.cacheService.set(cacheKey, member.id.value, this.cacheTTL);

    return member;
  }

  async emailExists(email: Email): Promise<boolean> {
    const count = await this.entityManager.count(MemberEntity, {
      where: { email: email.normalized },
    });
    return count > 0;
  }
}
```

---

### Aggregate-to-Entity Mapper

```typescript
// src/infrastructure/identity/mappers/MemberMapper.ts

export class MemberMapper implements AggregateMapper<Member, MemberEntity> {
  toDomain(entity: MemberEntity): Member {
    return Member.reconstitute(
      MemberId.from(entity.id),
      Email.from(entity.email),
      Credential.fromHash(entity.passwordHash),
      MemberStatus.from(entity.status),
      entity.failedLoginCount,
      entity.lockedUntil ? Timestamp.from(entity.lockedUntil) : null,
      entity.version
    );
  }

  toPersistence(aggregate: Member): MemberEntity {
    const entity = new MemberEntity();
    entity.id = aggregate.id.value;
    entity.email = aggregate.email.normalized;
    entity.passwordHash = aggregate.credential.hash;
    entity.status = aggregate.status.value;
    entity.failedLoginCount = aggregate.failedLoginCount;
    entity.lockedUntil = aggregate.lockedUntil?.value ?? null;
    entity.version = aggregate.version;
    return entity;
  }
}
```

---

### 3-Tier Caching Strategy

```typescript
// src/infrastructure/shared/cache/ThreeTierCacheService.ts

export class ThreeTierCacheService implements CacheService {
  private localCache: Map<string, { data: unknown; expiresAt: number }>;
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.localCache = new Map();
    this.redis = redisClient;

    // Prune local cache every minute
    setInterval(() => this.pruneLocalCache(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    // Tier 1: Local memory cache (fastest)
    const local = this.localCache.get(key);
    if (local && local.expiresAt > Date.now()) {
      return local.data as T;
    }

    // Tier 2: Redis cache
    const redisData = await this.redis.get(key);
    if (redisData) {
      const parsed = JSON.parse(redisData) as T;

      // Populate local cache (short TTL)
      this.localCache.set(key, {
        data: parsed,
        expiresAt: Date.now() + 30000, // 30 seconds local
      });

      return parsed;
    }

    // Tier 3: Database (handled by repository)
    return null;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    // Set in Redis
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);

    // Set in local cache (shorter TTL)
    this.localCache.set(key, {
      data: value,
      expiresAt: Date.now() + Math.min(ttl * 1000, 30000),
    });
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
    this.localCache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Use SCAN instead of KEYS to avoid blocking Redis
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    // Local cache pattern delete
    for (const [key] of this.localCache) {
      if (this.matchesPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }
  }

  async getTTL(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(key);
  }

  private pruneLocalCache(): void {
    const now = Date.now();
    for (const [key, value] of this.localCache) {
      if (value.expiresAt <= now) {
        this.localCache.delete(key);
      }
    }
  }
}
```

#### Cache TTL Configuration per Aggregate

| Aggregate | Cache Prefix | Redis TTL | Rationale |
|-----------|-------------|-----------|-----------|
| Member | `member` | 1 hour | Auth data changes infrequently |
| Profile | `profile` | 30 minutes | Users update profiles occasionally |
| Publication | `publication` | 2 hours | Content rarely changes after creation |
| Discussion | `discussion` | 1 hour | Comments are append-mostly |
| Connection | `connection` | 15 minutes | Follow status can change frequently |
| Block | `block` | 1 hour | Blocks change infrequently |
| Group | `group` | 2 hours | Group settings rarely change |
| Membership | `membership` | 30 minutes | Role changes need relatively fast propagation |
| Alert | `alert` | 5 minutes | Read status changes frequently |
| Preference | `preference` | 24 hours | Notification preferences rarely change |
| Administrator | `admin` | 1 hour | Admin data changes infrequently |

**Local memory cache**: Always 30 seconds regardless of aggregate type (prevents stale reads).

#### Cache Stampede Prevention

When a popular cache entry expires, many concurrent requests may simultaneously attempt to rebuild the cache (thundering herd problem). We use **probabilistic early expiration** to prevent this:

```typescript
// src/infrastructure/shared/cache/StampedeProtection.ts

export class ProbabilisticCache {
  /**
   * Returns true if cache should be refreshed early.
   * Uses the "XFetch" algorithm: probability of early refresh
   * increases as expiry approaches.
   *
   * @param ttl - remaining TTL in seconds
   * @param delta - time to recompute the value (estimated)
   * @param beta - tuning parameter (default: 1.0)
   */
  static shouldRefreshEarly(ttl: number, delta: number, beta: number = 1.0): boolean {
    const random = Math.random();
    const threshold = delta * beta * Math.log(random);
    return -threshold >= ttl;
  }
}

// Usage in repository findById
async findById(id: ID): Promise<T | null> {
  const cached = await this.getFromCache(id);
  if (cached) {
    const ttl = await this.cacheService.getTTL(`${this.cachePrefix}:${id}`);
    const estimatedComputeTime = 0.05; // 50ms estimated DB query time

    // Probabilistically refresh before expiry
    if (ProbabilisticCache.shouldRefreshEarly(ttl, estimatedComputeTime)) {
      // Refresh in background, return cached value immediately
      this.refreshCacheAsync(id);
    }

    return cached;
  }

  // Cache miss - fetch from DB
  return this.fetchAndCache(id);
}
```

---

### Query Specifications (Optional Pattern)

```typescript
// src/domain/content/specifications/PublicationSpecification.ts

export interface PublicationSpecification {
  toQuery(): QueryCriteria;
}

export class AuthorSpecification implements PublicationSpecification {
  constructor(private authorId: MemberId) {}

  toQuery(): QueryCriteria {
    return { authorId: this.authorId.value };
  }
}

export class VisibilitySpecification implements PublicationSpecification {
  constructor(private visibility: Visibility) {}

  toQuery(): QueryCriteria {
    return { visibility: this.visibility.value };
  }
}

export class NotDeletedSpecification implements PublicationSpecification {
  toQuery(): QueryCriteria {
    return { deletedAt: null };
  }
}

// Composite specification
export class AndSpecification implements PublicationSpecification {
  constructor(private specs: PublicationSpecification[]) {}

  toQuery(): QueryCriteria {
    return this.specs.reduce(
      (acc, spec) => ({ ...acc, ...spec.toQuery() }),
      {}
    );
  }
}

// Repository usage
export interface PublicationRepository {
  findBySpecification(
    spec: PublicationSpecification,
    options: PaginationOptions
  ): Promise<PaginatedResult<Publication>>;
}
```

---

### Unit of Work Pattern (Optional)

```typescript
// src/infrastructure/shared/persistence/UnitOfWork.ts

export interface UnitOfWork {
  /**
   * Register an aggregate for tracking changes.
   */
  registerNew<T extends AggregateRoot>(aggregate: T): void;

  /**
   * Register a modified aggregate.
   */
  registerDirty<T extends AggregateRoot>(aggregate: T): void;

  /**
   * Register an aggregate for deletion.
   */
  registerDeleted<T extends AggregateRoot>(aggregate: T): void;

  /**
   * Commit all registered changes in a single transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback all pending changes.
   */
  rollback(): Promise<void>;
}

// Implementation
export class TypeORMUnitOfWork implements UnitOfWork {
  private newAggregates: AggregateRoot[] = [];
  private dirtyAggregates: AggregateRoot[] = [];
  private deletedAggregates: AggregateRoot[] = [];

  constructor(
    private dataSource: DataSource,
    private repositoryRegistry: RepositoryRegistry,
    private eventPublisher: EventPublisher
  ) {}

  registerNew<T extends AggregateRoot>(aggregate: T): void {
    this.newAggregates.push(aggregate);
  }

  registerDirty<T extends AggregateRoot>(aggregate: T): void {
    this.dirtyAggregates.push(aggregate);
  }

  registerDeleted<T extends AggregateRoot>(aggregate: T): void {
    this.deletedAggregates.push(aggregate);
  }

  async commit(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Process all aggregates
      for (const aggregate of this.newAggregates) {
        const repo = this.repositoryRegistry.getFor(aggregate);
        await repo.save(aggregate);
      }

      for (const aggregate of this.dirtyAggregates) {
        const repo = this.repositoryRegistry.getFor(aggregate);
        await repo.save(aggregate);
      }

      for (const aggregate of this.deletedAggregates) {
        const repo = this.repositoryRegistry.getFor(aggregate);
        await repo.delete(aggregate);
      }

      await queryRunner.commitTransaction();

      // Publish all events after successful commit
      const allAggregates = [
        ...this.newAggregates,
        ...this.dirtyAggregates,
        ...this.deletedAggregates,
      ];

      for (const aggregate of allAggregates) {
        const events = aggregate.pullDomainEvents();
        for (const event of events) {
          await this.eventPublisher.publish(event);
        }
      }

      this.clear();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rollback(): Promise<void> {
    this.clear();
  }

  private clear(): void {
    this.newAggregates = [];
    this.dirtyAggregates = [];
    this.deletedAggregates = [];
  }
}
```

---

### Dependency Injection Setup

```typescript
// src/infrastructure/bootstrap/RepositoryModule.ts

@Module({
  providers: [
    // Mappers
    { provide: 'MemberMapper', useClass: MemberMapper },
    { provide: 'ProfileMapper', useClass: ProfileMapper },
    { provide: 'PublicationMapper', useClass: PublicationMapper },
    // ... other mappers

    // Cache
    {
      provide: 'CacheService',
      useFactory: (redis: Redis) => new ThreeTierCacheService(redis),
      inject: ['Redis'],
    },

    // Repositories
    {
      provide: 'MemberRepository',
      useFactory: (em: EntityManager, cache: CacheService, publisher: EventPublisher, mapper: MemberMapper) =>
        new PostgresMemberRepository(em, cache, publisher, mapper),
      inject: [EntityManager, 'CacheService', 'EventPublisher', 'MemberMapper'],
    },
    // ... other repositories

    // Unit of Work (optional)
    {
      provide: 'UnitOfWork',
      useClass: TypeORMUnitOfWork,
    },
  ],
  exports: [
    'MemberRepository',
    'ProfileRepository',
    'PublicationRepository',
    // ... other exports
  ],
})
export class RepositoryModule {}
```

---

### Testing Strategy

```typescript
// src/domain/identity/__tests__/MemberRepository.test.ts

// In-memory implementation for unit tests
class InMemoryMemberRepository implements MemberRepository {
  private members: Map<string, Member> = new Map();
  private idCounter = 0;

  nextId(): MemberId {
    return MemberId.from(`test-${++this.idCounter}`);
  }

  async save(member: Member): Promise<void> {
    this.members.set(member.id.value, member);
  }

  async findById(id: MemberId): Promise<Member | null> {
    return this.members.get(id.value) ?? null;
  }

  async findByEmail(email: Email): Promise<Member | null> {
    for (const member of this.members.values()) {
      if (member.email.equals(email)) {
        return member;
      }
    }
    return null;
  }

  async emailExists(email: Email): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async exists(id: MemberId): Promise<boolean> {
    return this.members.has(id.value);
  }

  async delete(member: Member): Promise<void> {
    this.members.delete(member.id.value);
  }

  // Test helpers
  clear(): void {
    this.members.clear();
    this.idCounter = 0;
  }
}

// Usage in tests
describe('RegisterMemberHandler', () => {
  let repository: InMemoryMemberRepository;
  let handler: RegisterMemberHandler;

  beforeEach(() => {
    repository = new InMemoryMemberRepository();
    handler = new RegisterMemberHandler(repository);
  });

  it('should register a new member', async () => {
    const command = new RegisterMemberCommand(
      'test@example.com',
      'SecurePass123!'
    );

    const memberId = await handler.execute(command);

    const member = await repository.findById(memberId);
    expect(member).not.toBeNull();
    expect(member?.email.value).toBe('test@example.com');
  });
});
```

#### Optimistic Lock Retry Strategy

When an `OptimisticLockError` occurs, the application layer may retry the operation:

```typescript
// src/application/shared/RetryableCommandHandler.ts

export abstract class RetryableCommandHandler<TCommand, TResult> {
  private readonly maxRetries = 3;
  private readonly baseDelay = 50; // ms

  async execute(command: TCommand): Promise<TResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.handle(command);
      } catch (error) {
        if (error instanceof OptimisticLockError && attempt < this.maxRetries) {
          lastError = error;
          // Exponential backoff with jitter
          const delay = this.baseDelay * Math.pow(2, attempt) + Math.random() * 50;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  protected abstract handle(command: TCommand): Promise<TResult>;
}
```

| Retry Parameter | Value | Rationale |
|----------------|-------|-----------|
| Max retries | 3 | Sufficient for transient conflicts |
| Base delay | 50ms | Short enough for interactive operations |
| Backoff | Exponential (50, 100, 200ms) | Reduces collision probability |
| Jitter | Random 0-50ms | Prevents synchronized retries |

## Consequences

### Positive

- **Domain Purity**: Domain layer has no infrastructure dependencies
- **Testability**: Domain logic tested with in-memory repositories
- **Flexibility**: Easy to swap persistence implementation
- **Performance**: 3-tier caching achieves 85-90% hit rate
- **Consistency**: Optimistic locking prevents lost updates
- **Event Publishing**: Domain events published after successful save

### Negative

- **Complexity**: More code for interfaces, implementations, mappers
- **Learning Curve**: Team needs to understand pattern
- **Overhead**: Mapper conversions add CPU cost

### Mitigation

- **Complexity**: Generate boilerplate with code generators
- **Learning**: Provide reference implementations and documentation
- **Overhead**: Cache aggressively; mapper cost is negligible

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Cache Hit Rate | 85-90% | 3-tier caching |
| findById Latency | < 10ms (cached) | Local memory cache |
| findById Latency | < 50ms (cold) | Redis + PostgreSQL |
| Save Latency | < 100ms | Single transaction |
| Connection Pool | 20 connections | TypeORM pool config |

## References

- Evans, E. (2003). Domain-Driven Design - Chapter 6: Repositories
- Vernon, V. (2013). Implementing Domain-Driven Design - Chapter 12: Repositories
- System Architecture Specification - Caching Strategy sections
- TypeORM Documentation - https://typeorm.io/
