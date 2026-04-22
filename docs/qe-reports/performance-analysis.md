# Performance Analysis Report
**Project**: Community Social Network  
**Date**: 2026-04-21  
**Reviewer**: V3 QE Performance Reviewer (chaos-resilience domain)  
**Scope**: `libs/`, `apps/api/src/`, `apps/web/src/`

---

## Executive Summary

| Category | Findings | Critical | High | Medium | Low |
|----------|----------|----------|------|--------|-----|
| N+1 / Query Efficiency | 5 | 1 | 2 | 2 | 0 |
| Missing Indexes | 3 | 0 | 2 | 1 | 0 |
| Unbounded Queries | 3 | 1 | 1 | 1 | 0 |
| Cache Utilization | 2 | 0 | 1 | 1 | 0 |
| Blocking Operations | 2 | 0 | 1 | 1 | 0 |
| Frontend Performance | 3 | 0 | 1 | 1 | 1 |
| Memory / Resource | 2 | 0 | 0 | 1 | 1 |

**Weighted score**: 1×3 + 6×2 + 7×1 + 1×0.5 = **22.5** (minimum threshold 2.0 — far exceeds threshold)

---

## 1. N+1 Query Risks

### 1.1 CRITICAL — Feed handler loads all posts into memory before cursor pagination

**File**: `apps/api/src/modules/content/queries/get-feed.handler.ts:32-52`

```
const allPosts = await this.publicationRepository.findByAuthorId(userId);
// Then slices in memory:
const pageItems = filtered.slice(0, requestedLimit + 1);
```

`findByAuthorId` in `postgres-publication.repository.ts:100-113` performs an eager load of all publications for a user, including their `mentions` and `reactions` relations (using `relations: ['mentions', 'reactions']`). This means fetching a feed page for a user with 5,000 posts issues one query returning all 5,000 rows plus JOIN data for mentions and reactions on every row — all just to apply an in-memory cursor slice.

**Impact at scale**: At 1,000 posts/user this transfers ~1 MB+ per feed request; at 10,000 posts it becomes impractical. The cursor pagination logic itself is O(n) in memory.

**Recommended fix**: Push cursor/limit into the repository query. A single SQL query with `WHERE created_at < $cursor ORDER BY created_at DESC LIMIT $n` with a covering index on `(author_id, created_at)` would be O(log n) instead of O(n) in data transferred and O(1) in memory.

---

### 1.2 HIGH — Publication save performs a COUNT before every write (double-trip pattern)

**File**: `libs/infrastructure/shared/src/repositories/base.repository.ts:50`

```typescript
const existsInDb =
  (await this.ormRepository.count({ where: this.idCondition(aggregate.id) })) > 0;
```

Every call to `save()` on any aggregate issues a `SELECT COUNT(*)` before deciding whether to `INSERT` or `UPDATE`. For a write-heavy path (e.g., `AddReactionHandler` which calls `findById` + `save`), this means three round-trips per reaction: `SELECT * (findById)`, `SELECT COUNT(*) (exists check)`, `UPDATE`. Under concurrent load the aggregate version is already loaded by `findById` and could be used directly to determine insert vs. update without a second DB query.

**Impact**: Doubles write latency; counts as 2× DB connections under high concurrency.

**Recommended fix**: Use `aggregate.version <= 1` as the insert heuristic (with `ON CONFLICT DO UPDATE` / upsert) or pass a boolean `isNew` flag from the caller. The `@VersionColumn` already provides this information.

---

### 1.3 HIGH — Reaction and mention handling on publications causes separate DELETE + INSERT on every post save

**File**: `libs/infrastructure/content/src/repositories/postgres-publication.repository.ts:86-97`

```typescript
await this.mentionRepository.delete({ publicationId: aggregate.id.value });
if (bundle.mentions.length > 0) {
  await this.mentionRepository.save(bundle.mentions);
}
```

On every `save()` call for a `Publication` (including add/remove reaction operations that go through `super.save()`), the mentions table is cleared and re-inserted. A post with 10 mentions will delete 10 rows and re-insert 10 rows even when no mentions changed. The comment in the code acknowledges this as a design choice but it creates unnecessary write amplification on every reaction operation.

---

### 1.4 MEDIUM — `GetPostHandler` fires two sequential awaits for every post detail view

**File**: `apps/api/src/modules/content/queries/get-post.handler.ts:22-29`

```typescript
const publication = await this.publicationRepository.findById(postId);
const discussions = await this.discussionRepository.findByPublicationId(postId);
```

These two queries are sequential and independent. They can be parallelized with `Promise.all`.

**Impact**: Doubles latency of the post detail endpoint. At 50ms per DB query this adds ~50ms to every `GET /posts/:id` response.

**Recommended fix**: `const [publication, discussions] = await Promise.all([..., ...])`.

---

### 1.5 MEDIUM — `GetCommentsHandler` fetches all comments for a post without pagination

**File**: `apps/api/src/modules/content/queries/get-comments.handler.ts:29`

`findByPublicationId` returns all discussions with no LIMIT. A post with 500 comments returns all 500 to the handler before the in-memory `calculateDepths` pass. `calculateDepths` itself is O(n) with memoization, which is acceptable, but loading all comments first is not.

**Recommended fix**: Add pagination parameters to `findByPublicationId` in the repository and pass them from the query handler.

---

## 2. Missing Database Indexes

### 2.1 HIGH — `publications` table has no composite index for social feed queries

**Entity file**: `libs/infrastructure/content/src/entities/publication.entity.ts`  
**Migration**: `libs/infrastructure/content/src/migrations/1710000002000-create-content-tables.ts`

The migration creates `IDX_publications_author_id`, `IDX_publications_status`, and `IDX_publications_created_at` as separate single-column indexes. A social feed query of the form `WHERE author_id = $1 AND status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 20` cannot use a composite index combining all three predicates. PostgreSQL will choose `IDX_publications_author_id` and then filter+sort in memory.

**Missing index**: `CREATE INDEX IDX_publications_author_status_created ON publications (author_id, status, created_at DESC)`. This allows index-only scans for feed retrieval.

---

### 2.2 HIGH — `audit_entries` table missing index on `timestamp` for date-range queries

**Entity file**: `libs/infrastructure/admin/src/entities/audit-entry.entity.ts`

`AuditEntryEntity` defines `IDX_audit_entries_actor_id` and `IDX_audit_entries_resource`. The `findByDateRange` method in `postgres-audit-entry.repository.ts:77-86` queries:

```sql
WHERE audit.timestamp >= :from AND audit.timestamp <= :to
ORDER BY audit.timestamp DESC
```

There is no index on `timestamp`. With an audit log that can grow to millions of rows, this is a full-table scan or an expensive sort. The `GetAuditLogHandler` also builds dynamic `WHERE` clauses with optional `actorId` + date range combinations — none of which are served by composite indexes.

**Missing index**: `CREATE INDEX IDX_audit_entries_timestamp ON audit_entries (timestamp DESC)`.  
For the most common combined query: `CREATE INDEX IDX_audit_entries_actor_timestamp ON audit_entries (actor_id, timestamp DESC)`.

---

### 2.3 MEDIUM — `discussions` entity missing `@Index` on `publication_id` at ORM level

**Entity file**: `libs/infrastructure/content/src/entities/discussion.entity.ts`

The migration creates `IDX_discussions_publication_id` in SQL. However the `DiscussionEntity` TypeORM class has no `@Index()` decorator on `publicationId`. This creates a drift risk: if the schema is regenerated from entities (`synchronize: true`) instead of from migrations, the index will be absent. The migration and the ORM entity definition are inconsistent.

---

## 3. Unbounded Queries

### 3.1 CRITICAL — `findFollowers` and `findFollowing` return all records with no pagination

**File**: `libs/infrastructure/social-graph/src/repositories/postgres-connection.repository.ts:45-60`

```typescript
async findFollowers(userId: UserId): Promise<Connection[]> {
  const entities = await this.ormRepository.find({ where: { followeeId: userId.value } });
  // ...
}
async findFollowing(userId: UserId): Promise<Connection[]> {
  const entities = await this.ormRepository.find({ where: { followerId: userId.value } });
  // ...
}
```

Both methods load the **complete** follower/following lists for a user with no `take` or `skip` clause. For a popular account with 100,000 followers this returns 100,000 rows and maps them all to domain objects on every call. These methods are called from `GetFollowersHandler` and `GetFollowingHandler` in the social-graph module.

**Impact**: O(n) memory and network cost per request where n = follower count. This is a scalability blocker for any user with significant following.

**Recommended fix**: Add `PaginationParams` to both methods (following the pattern already used in `findByGroupId`).

---

### 3.2 HIGH — `findByBlocker` has no pagination limit

**File**: `libs/infrastructure/social-graph/src/repositories/postgres-block.repository.ts:25-30`

```typescript
async findByBlocker(blockerId: UserId): Promise<Block[]> {
  const entities = await this.ormRepository.find({ where: { blockerId: blockerId.value } });
  ...
}
```

`GetBlocksHandler` calls this directly. A user who has blocked many accounts returns all of them in one query with no bound.

---

### 3.3 MEDIUM — `findByAuthorId` for publications lacks pagination

As covered in finding 1.1, `findByAuthorId` in `postgres-publication.repository.ts:100` loads all publications for a user unconditionally. This method is also in the domain interface `IPublicationRepository`, making it a contract-level issue — all implementations (including in-memory) will have the same unbounded behavior.

---

## 4. Redis Caching Opportunities

### 4.1 HIGH — Three-tier cache infrastructure built but not used in any handler

**Finding**: `libs/infrastructure/cache/src/` contains a production-ready `ThreeTierCacheService` with LRU memory tier, Redis backing, stampede protection, and pipeline support. The `CACHE_SERVICE` token is exported and the `RedisModule` is registered in `AppModule`. However, a search of all handler and repository files finds zero usage of `CACHE_SERVICE` or `ICacheService`. The cache infrastructure is entirely disconnected from the application query path.

**High-value caching opportunities not currently used**:

| Data | Read Pattern | Recommended TTL |
|------|--------------|-----------------|
| User profile by member ID | Every profile page view; rarely changes | 5 minutes |
| Unread notification count | Polled every 30s per browser tab | 15 seconds (matches `staleTime`) |
| Group details (`GroupEntity`) | High read, infrequent write | 2 minutes |
| Follower/following count | Shown on every profile | 1 minute |

The unread notification count endpoint (`GET /notifications/unread-count`) is particularly critical: the frontend polls it every 30 seconds per authenticated tab. At 1,000 concurrent users this is ~33 DB queries/second for a count that could be served from cache with a 15-second TTL.

---

### 4.2 MEDIUM — Block list not cached in Redis despite BlockContentFilterConsumer stub referencing it

**File**: `apps/api/src/consumers/block-content-filter.consumer.ts:71-76`

The consumer includes a comment: `// In production: SADD blocked:{blockerId} {blockedId}`. The `isBlocked` check in `PostgresBlockRepository` issues a `COUNT` query with two `OR` conditions on every request. Storing block relationships in Redis sets (`SADD blocked:{userId}`) and checking with `SISMEMBER` would reduce this to a sub-millisecond operation with no DB involvement.

---

## 5. Synchronous Blocking Operations in Async Contexts

### 5.1 HIGH — bcrypt hash/compare runs at 12 rounds in the request thread

**File**: `apps/api/src/modules/identity/commands/login-member.handler.ts:43`  
**File**: `apps/api/src/modules/identity/commands/register-member.handler.ts` (similar)

```typescript
const isValid = await bcrypt.compare(command.password, member.credential.value);
```

`bcrypt` at cost factor 12 takes approximately 200-400ms on modern hardware. While `await` yields the event loop during async IO, Node.js's `bcrypt` native binding (`bcryptjs` is pure JS; `bcrypt` uses a C++ addon) executes the hash computation in libuv worker threads. However, if the application is under concurrent login load, all worker threads can be saturated by bcrypt operations, blocking other async IO. This is expected behavior but must be accounted for in concurrency capacity planning.

**Recommendation**: Confirm `bcrypt` (not `bcryptjs`) is the actual package in use (the package.json lists `bcrypt: ^5.1.1` — correct, uses native bindings). Document the load ceiling: with 4 worker threads and 300ms per hash, maximum concurrent login throughput is ~13 requests/second per instance.

---

### 5.2 MEDIUM — GDPR erasure service runs multiple sequential queries without batching

**File**: `libs/infrastructure/gdpr/src/data-erasure.service.ts`

The `eraseMemberData` method runs 6+ sequential `queryRunner.query()` calls within a single transaction, each for a different bounded context. While this is intentionally transactional, the operations are fully sequential and each one awaits the previous. Some (e.g., deleting from `connections` and deleting from `blocks`) are independent and could run in parallel within the same transaction using concurrent query runners or a single multi-table transaction.

This is a lower-priority path (erasure is rare), but for users with large amounts of data it can hold a DB transaction open for extended periods.

---

## 6. Frontend Performance Concerns

### 6.1 HIGH — Notification count polled every 30s via HTTP; Socket.IO already connected

**Files**: `apps/web/src/features/notifications/hooks/useUnreadCount.ts`  
`apps/web/src/socket/socket-provider.tsx`

`useUnreadCount` uses `refetchInterval: 30 * 1000` to poll the REST endpoint every 30 seconds. The application already has a Socket.IO connection established (via `SocketProvider`). The `event-invalidation.ts` file shows infrastructure for handling socket events to invalidate TanStack Query caches. A `notification.new` socket event would eliminate polling entirely and give instant notification updates.

**Impact**: HTTP polling at 30s per connected browser tab generates 2 requests/minute per user. At 500 concurrent users this is ~1,000 HTTP requests/minute for notification count — all avoidable with a push notification via the existing socket.

---

### 6.2 MEDIUM — Socket event handler `useSocketEvents` has a stale closure risk

**File**: `apps/web/src/socket/use-socket-events.ts:33-53`

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [socket]);
```

`useSocketEvents` intentionally omits `handlers` from the dependency array to avoid re-subscribing on every render. The comment says "The handler is expected to be stable (wrap in useCallback at call site)." However, the exported API does not enforce this constraint, and call sites that pass inline handler objects will silently register stale closures. This is documented with an eslint-disable comment but no runtime guard or warning.

---

### 6.3 LOW — Vite bundle has no code splitting configured

**File**: `apps/web/vite.config.ts`

The Vite configuration has no `rollupOptions.output.manualChunks` configuration. All seven feature modules (feed, comments, profile, social, groups, notifications, admin) will be bundled into a single chunk. This means an unauthenticated user loading the login page will also download the admin dashboard code. Given the admin feature has a dedicated `Dashboard`, `UserManagement`, `SecurityAlerts`, `TwoFactorSetup`, and `AuditLog` component, this adds unnecessary bytes to the initial load.

**Recommended fix**: Add route-based lazy loading with `React.lazy` + `Suspense` for the admin module and potentially the groups/social features.

---

## 7. Memory / Resource Risks

### 7.1 MEDIUM — ThreeTierCacheService `pruneInterval` may not be cleared on module destroy

**File**: `libs/infrastructure/cache/src/three-tier-cache.service.ts`

The service sets `this.pruneInterval = setInterval(() => this.pruneExpired(), 60000)` and calls `.unref()` on it. The `destroy()` method calls `clearInterval`. However, `destroy()` is not a NestJS lifecycle hook — it must be called manually. The `RedisModule.onModuleDestroy` does call it, but only via a duck-typed check:

```typescript
if ('destroy' in this.cacheService && typeof ...) {
  (this.cacheService as { destroy(): void }).destroy();
}
```

If `ThreeTierCacheService` is provided directly without going through `RedisModule` (e.g., in tests), the interval will leak. Since `.unref()` is called, this will not prevent process exit, but it may cause confusing log output after tests.

---

### 7.2 LOW — `FeedList` accumulates all pages in TanStack Query `data.pages` indefinitely

**File**: `apps/web/src/features/feed/components/FeedList.tsx:55`

```typescript
const posts = data?.pages.flatMap((page) => page.items) ?? [];
```

`useInfiniteQuery` keeps all fetched pages in `data.pages` for the lifetime of the component. With `gcTime: 5 * 60 * 1000` (5 minutes), a user who scrolls through 100 pages of 20 posts each will hold 2,000 post objects in browser memory. This is expected behavior for infinite scroll but should be bounded in production with `maxPages` option (TanStack Query v5 supports `maxPages` in `useInfiniteQuery`).

---

## Summary Table

| ID | Severity | Category | Location | Issue |
|----|----------|----------|----------|-------|
| P1.1 | CRITICAL | Unbounded Query | `get-feed.handler.ts` | Full table load before in-memory cursor pagination |
| P3.1 | CRITICAL | Unbounded Query | `postgres-connection.repository.ts` | `findFollowers`/`findFollowing` no pagination |
| P1.2 | HIGH | Query Efficiency | `base.repository.ts:50` | COUNT query before every save (double trip) |
| P1.4 | HIGH | Query Efficiency | `get-post.handler.ts` | Sequential awaits for independent queries |
| P2.1 | HIGH | Missing Index | `publication.entity.ts` | No composite index for feed query pattern |
| P2.2 | HIGH | Missing Index | `audit-entry.entity.ts` | No index on `timestamp` for date-range queries |
| P3.2 | HIGH | Unbounded Query | `postgres-block.repository.ts` | `findByBlocker` no pagination |
| P4.1 | HIGH | Cache Utilization | All handlers | Three-tier cache built but unused |
| P5.1 | HIGH | Blocking Operation | `login-member.handler.ts` | bcrypt 12-round capacity ceiling needs documentation |
| P6.1 | HIGH | Frontend | `useUnreadCount.ts` | HTTP polling when WebSocket already connected |
| P1.3 | MEDIUM | Query Efficiency | `postgres-publication.repository.ts` | DELETE+INSERT on mentions for every save |
| P1.5 | MEDIUM | Unbounded Query | `get-comments.handler.ts` | All comments loaded without pagination |
| P2.3 | MEDIUM | Missing Index | `discussion.entity.ts` | ORM entity missing `@Index` — drift from migration |
| P4.2 | MEDIUM | Cache Utilization | `block-content-filter.consumer.ts` | Block list not cached in Redis despite stub |
| P5.2 | MEDIUM | Blocking Operation | `data-erasure.service.ts` | Sequential GDPR erasure queries |
| P6.2 | MEDIUM | Frontend | `use-socket-events.ts` | Stale closure risk in socket event hook |
| P7.1 | MEDIUM | Memory | `three-tier-cache.service.ts` | `destroy()` not a NestJS lifecycle hook |
| P6.3 | LOW | Bundle Size | `vite.config.ts` | No route-based code splitting |
| P7.2 | LOW | Memory | `FeedList.tsx` | Infinite query pages accumulate unbounded |
