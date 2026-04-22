# Defect Prediction Report
**Agent**: V3 QE Defect Predictor  
**Project**: community-social-network  
**Branch**: ddd-approach  
**Date**: 2026-04-21  
**Scope**: Root cause analysis, latent bug prediction, cross-context wiring, data integrity

---

## 1. Root Cause Analysis: 11 Failing Tests in base.repository.spec.ts

### 1.1 The Bug

**File**: `libs/infrastructure/shared/src/repositories/base.repository.ts`

The production `save()` method (lines 47-90) uses a **read-then-write** pattern:

```typescript
async save(aggregate: TDomain): Promise<void> {
  const entity = this.mapper.toPersistence(aggregate);
  const existsInDb =
    (await this.ormRepository.count({ where: this.idCondition(aggregate.id) })) > 0;

  if (!existsInDb) {
    await this.ormRepository.save(entity);          // INSERT path
  } else {
    // UPDATE path with optimistic lock via query builder
  }
}
```

The implementation routes to INSERT vs UPDATE by calling `ormRepository.count()` at the start of every `save()`. The test suite, however, was written against a **version-based routing contract**:

- Version `<= 1` → INSERT path (`ormRepository.save`)
- Version `> 1`  → UPDATE path (query builder + optimistic lock)

The mock ORM's `count` is set up to return `0` by default (`mockOrm.count.mockResolvedValue(0)`), meaning `existsInDb` is always `false`, so every call—regardless of version—routes to `ormRepository.save()`. The update path (query builder) is never exercised.

### 1.2 Failing Tests Explained

| Failing Test | Why It Fails |
|---|---|
| "should handle aggregate with version=2 directly (update path)" | aggregate.version=2, but count=0 → INSERT path taken → `createQueryBuilder` never called → assertion fails |
| "should propagate query builder execute errors for existing aggregates" | aggregate.version=4 after rename, count=0 → INSERT path taken → `qb.execute` mock rejection never reached → error does not propagate |

The remaining 9 failing tests follow the same pattern: all tests in `describe('save() with existing aggregate (version > 1)')`, `describe('save() with version conflict')`, `describe('save() atomicity')`, and the related edge case. All rely on the query builder path being reached for version > 1. Because `count` always returns 0, the query builder is never invoked.

### 1.3 Proposed Fix

Replace the `count`-based routing with version-based routing, matching the contract the test suite specifies and the docstring already describes:

```typescript
async save(aggregate: TDomain): Promise<void> {
  const entity = this.mapper.toPersistence(aggregate);

  if (aggregate.version <= 1) {
    // New aggregate: insert directly, no optimistic lock needed.
    await this.ormRepository.save(entity);
  } else {
    // Existing aggregate: version-conditioned UPDATE for atomic optimistic locking.
    const previousVersion = aggregate.version - 1;
    const condition = this.idCondition(aggregate.id);

    const qb = this.ormRepository
      .createQueryBuilder()
      .update()
      .set(entity as unknown as Record<string, unknown>);

    const conditionEntries = Object.entries(
      condition as Record<string, unknown>,
    );
    for (const [key, value] of conditionEntries) {
      qb.andWhere(`"${key}" = :${key}`, { [key]: value });
    }

    qb.andWhere('"version" = :previousVersion', { previousVersion });

    const result = await qb.execute();

    if (result.affected === 0) {
      throw new OptimisticLockError(
        aggregate.constructor.name,
        String(aggregate.id),
      );
    }
  }
}
```

**Key change**: Remove the `count()` call entirely. Route on `aggregate.version <= 1` for INSERT, `> 1` for UPDATE. This is atomic (no read-before-write window), matches the test contract, and is consistent with the class-level docstring. The secondary effect is also an elimination of an extra DB round-trip on every save.

**Risk of the current code in production** (beyond test failures): the existing implementation calls `count()` then writes, which is a non-atomic read-modify-write pair. Under concurrent load a second writer can insert the same aggregate between the `count` call and the `save`, resulting in a duplicate insert or silent data loss depending on the DB unique constraints.

---

## 2. Defect Probability Scores Per Module

Scores are on a 1-10 scale where 10 = highest defect probability. Factors: cyclomatic complexity, known bugs, test gaps, coupling, and behavioral severity.

| Module | File | Score | Primary Risk |
|---|---|---|---|
| base.repository | `libs/infrastructure/shared/src/repositories/base.repository.ts` | **9** | Confirmed bug: count-based routing breaks 11 tests; race condition in production |
| verify-2fa.handler | `libs/infrastructure/auth/src/` (handler not found, confirmed missing) | **9** | C-01 critical: 2FA verification broken per prior audit |
| notification-trigger.consumer | `apps/api/src/consumers/notification-trigger.consumer.ts` | **7** | 3 of 5 handlers are stubs; PublicationCreated, ReactionAdded, DiscussionCreated produce no alerts |
| block-content-filter.consumer | `apps/api/src/consumers/block-content-filter.consumer.ts` | **8** | Both handlers are stubs; Redis SADD/SREM never executed; block feature entirely non-functional |
| data-export.service | `libs/infrastructure/` (previously flagged) | **7** | In-memory Map state, cyclomatic 12; not read in this session |
| three-tier-cache.service | `libs/infrastructure/cache/src/three-tier-cache.service.ts` | **5** | O(n) LRU eviction scan; Redis error swallowed silently; memory/Redis write-ordering gap |
| key-rotation.service | `libs/infrastructure/auth/src/key-rotation.service.ts` | **6** | CURRENT_KEY_ID key has no TTL; two-phase key store non-atomic; Redis failure = auth outage |
| jwt.service | `libs/infrastructure/auth/src/jwt.service.ts` | **4** | Silent `continue` on all verify errors masks root cause; roles array not validated |
| dead-letter-queue | `libs/infrastructure/messaging/src/dead-letter-queue.ts` | **5** | O(n) full list scan for retry; retry writes to `retry:` list not consumed by BullMQ |
| group aggregate | `libs/domain/community/src/aggregates/group.ts` | **3** | incrementMemberCount not version-guarded; no event on archive/rule changes |
| publication aggregate | `libs/domain/content/src/aggregates/publication.ts` | **3** | removeReaction never emits event; reactionCounts not serialized by mapper (likely) |
| member aggregate | `libs/domain/identity/src/aggregates/member.ts` | **3** | recordFailedLogin increments version even when no lock transition occurs |
| profile-creator.consumer | `apps/api/src/consumers/profile-creator.consumer.ts` | **2** | Fully implemented; double-check idempotency is sound |
| audit-logger.consumer | `apps/api/src/consumers/audit-logger.consumer.ts` | **2** | Fully implemented; hardcoded IP '0.0.0.0' is a data quality issue, not a crash |
| token-blacklist.service | `libs/infrastructure/auth/src/token-blacklist.service.ts` | **3** | TTL race: token tracked but not yet valid for blacklisting window |

---

## 3. Top 15 Latent Bug Predictions With Evidence

### BUG-001 (Severity: CRITICAL) - base.repository: TOCTOU race condition on INSERT
**File**: `libs/infrastructure/shared/src/repositories/base.repository.ts:49-51`  
**Evidence**: `count()` then `save()` are two separate DB round-trips. Under concurrent registrations of the same entity (e.g., duplicate form submission), both calls can see count=0 and both proceed to INSERT, creating a duplicate if the DB has no unique constraint, or throwing an unhandled FK/unique error that is not wrapped.  
**Fix**: Version-based routing (see Section 1.3) eliminates the race entirely.

### BUG-002 (Severity: CRITICAL) - block-content-filter.consumer: block feature completely inert
**File**: `apps/api/src/consumers/block-content-filter.consumer.ts:72-77, 87-92`  
**Evidence**: Both `onMemberBlocked` and `onMemberUnblocked` handlers contain only a `logger.log()` call. The Redis `SADD blocked:{blockerId} {blockedId}` and `SREM` operations documented in the class comment are never executed. Users who block others will still see their content in feeds. The MemberBlocked event is consumed, marked idempotent, and silently discarded.

### BUG-003 (Severity: HIGH) - notification-trigger.consumer: 3 of 5 notification paths are no-ops
**File**: `apps/api/src/consumers/notification-trigger.consumer.ts`  
- `onPublicationCreated` (lines 109-122): logs only; no Alert created; followers never notified of new posts
- `onDiscussionCreated` (lines 124-151): Alert object is constructed but `alertRepository.save()` is commented out; no notification delivered to publication author
- `onReactionAdded` (lines 153-167): logs only; content author never notified of reactions  
- `onFollowRequested` (lines 170-198): FULLY IMPLEMENTED - creates and saves Alert  
- `onMemberMentioned` (lines 200-230): FULLY IMPLEMENTED - creates and saves Alert  

**Impact**: Notification inbox is populated only for follow and mention events. New post and reaction notifications are silently dropped.

### BUG-004 (Severity: HIGH) - key-rotation.service: current key stored without TTL, loss of key material on Redis flush
**File**: `libs/infrastructure/auth/src/key-rotation.service.ts:157`  
**Evidence**: `await this.redis.set(CURRENT_KEY_ID_KEY, keyId)` — no `EX` TTL. The key material IS stored with a 24h TTL (`KEY_MATERIAL_TTL_SECONDS`). If Redis is flushed or the key material expires but the pointer key survives, `getSigningKey()` hits the `!key` branch and falls back to `config.accessSecret`. Tokens signed with the rotated key will fail verification because the fallback key is different from the stored key material. This causes a complete auth outage for all sessions signed after the last rotation.

### BUG-005 (Severity: HIGH) - key-rotation.service: non-atomic two-phase key rotation
**File**: `libs/infrastructure/auth/src/key-rotation.service.ts:91-104`  
**Evidence**: `rotateKey()` performs three sequential Redis writes:
1. `PREVIOUS_KEY_ID_KEY = currentKeyId` (grace period)
2. `generateAndStoreKey()` which writes key material then sets CURRENT_KEY_ID_KEY

Between step 1 and step 2, if the process crashes or Redis times out, the old key is demoted to "previous" but no new current key exists. Subsequent `getSigningKey()` calls return `config.accessSecret`, invalidating all in-flight tokens. There is no transaction, MULTI/EXEC, or Lua script protecting atomicity.

### BUG-006 (Severity: HIGH) - jwt.service: verifyAccessToken silently swallows all verification errors
**File**: `libs/infrastructure/auth/src/jwt.service.ts:145-156`  
**Evidence**:
```typescript
for (const key of keys) {
  try {
    decoded = this.nestJwtService.verify(...);
    break;
  } catch {
    continue;   // ← bare catch, no logging
  }
}
```
Every error—including `JsonWebTokenError`, `NotBeforeError`, algorithmically invalid tokens, tampered tokens—is silently swallowed. Only after exhausting all keys does it throw `UnauthorizedException`. This makes debugging auth failures extremely difficult and could mask a scenario where ALL keys are expired simultaneously (which should throw a specific "all keys expired" error rather than "invalid token").

### BUG-007 (Severity: MEDIUM) - three-tier-cache.service: Redis write succeeds but memory write is skipped on Redis error
**File**: `libs/infrastructure/cache/src/three-tier-cache.service.ts:80-93`  
**Evidence**: In `set()`, the Redis `try/catch` catches errors and logs them, then falls through to `this.setMemory(key, value)`. This means if Redis SET fails, memory cache is still populated. The next `get()` will return a cache hit from memory, but Redis is empty. When the memory TTL expires (30s), the next `get()` misses both tiers and goes to the database. This inconsistency is benign for reads but means callers cannot trust that `set()` guarantees durability—a silent degraded-mode behavior with no signal to the caller.

### BUG-008 (Severity: MEDIUM) - three-tier-cache.service: O(n) LRU eviction scan
**File**: `libs/infrastructure/cache/src/three-tier-cache.service.ts:269-283`  
**Evidence**: `evictLru()` iterates the entire `memoryCache` Map to find the least-recently-used entry. With `maxMemoryEntries=1000`, this is a 1000-entry linear scan on every cache write that hits capacity. Under high-write workloads this degrades cache performance. A proper O(1) LRU requires a doubly-linked list with a hash map (standard LRU-Cache pattern). The `Map` insertion order is maintained in JS but is not equivalent to access order—entries are not re-inserted on read, so the "LRU" approximation using `lastAccessed` timestamp requires O(n) scan.

### BUG-009 (Severity: MEDIUM) - dead-letter-queue: retryDeadLetterJob writes to `retry:` list not consumed by BullMQ
**File**: `libs/infrastructure/messaging/src/dead-letter-queue.ts:121`  
**Evidence**: `await this.redis.lpush(retryKey, JSON.stringify(targetEntry.data))` pushes to a plain Redis list keyed `retry:{queue}`. BullMQ does not poll plain Redis lists for jobs; it uses its own internal data structures. There is no evidence in the codebase of a consumer that reads from `retry:{queue}` lists. This means the retry operation removes the job from the DLQ (it is no longer inspectable) but never actually re-queues it into BullMQ for processing. Failed jobs that are "retried" are silently discarded.

### BUG-010 (Severity: MEDIUM) - dead-letter-queue: O(n) linear scan for retry
**File**: `libs/infrastructure/messaging/src/dead-letter-queue.ts:98-109`  
**Evidence**: `retryDeadLetterJob` calls `redis.lrange(key, 0, -1)` to fetch ALL entries in the DLQ for a given queue, then iterates to find the target by job ID. If a queue accumulates thousands of failed jobs (possible under persistent downstream failure), this is an unbounded memory load and O(n) CPU scan. No pagination, no Redis hash-based index by job ID.

### BUG-011 (Severity: MEDIUM) - group aggregate: incrementMemberCount not version-guarded, no domain event
**File**: `libs/domain/community/src/aggregates/group.ts:216-224`  
**Evidence**: `incrementMemberCount()` and `decrementMemberCount()` mutate `_memberCount` without calling `incrementVersion()` and without emitting domain events. This means:
1. Optimistic locking will not detect concurrent member count changes (version is stale)
2. No domain event is raised when a member joins/leaves, so downstream notification/audit consumers are blind to membership changes
3. If the group is reconstituted from DB and `_memberCount` is recalculated separately, these calls are silently inconsistent with the aggregate version

### BUG-012 (Severity: MEDIUM) - publication aggregate: removeReaction emits no event
**File**: `libs/domain/content/src/aggregates/publication.ts:207-214`  
**Evidence**: `removeReaction()` decrements the reaction count and increments version but raises no domain event. A `ReactionRemovedEvent` equivalent is missing. Any consumer that tracks reaction analytics will see reactions added but never removed, producing incorrect counts over time.

### BUG-013 (Severity: MEDIUM) - publication aggregate: reactionCounts Map not serializable by TypeORM without explicit JSON column
**File**: `libs/domain/content/src/aggregates/publication.ts:23`  
**Evidence**: `_reactionCounts` is typed as `Map<string, number>`. TypeORM cannot serialize a JS `Map` to a DB column automatically; a `json` column requires the mapper's `toPersistence` to convert it to a plain object and `toDomain` to convert back. If the mapper does not handle this conversion, all reaction counts are lost on save/load (stored as empty object `{}`). This is a latent data loss bug dependent on mapper implementation.

### BUG-014 (Severity: LOW) - member aggregate: recordFailedLogin increments version even when not locking
**File**: `libs/domain/identity/src/aggregates/member.ts:145-161`  
**Evidence**: `incrementVersion()` is called unconditionally at the end of `recordFailedLogin()`, but the lock transition and `MemberLockedEvent` are only emitted when the threshold is reached. This means every failed login produces a version bump whether or not meaningful state changed. Under high failed-login volume this inflates version numbers and increases optimistic lock conflict probability for concurrent requests on the same member aggregate.

### BUG-015 (Severity: LOW) - audit-logger.consumer: hardcoded IP '0.0.0.0' in all audit entries
**File**: `apps/api/src/consumers/audit-logger.consumer.ts:87, 117, 148`  
**Evidence**: All three audit handlers call `IpAddress.create('0.0.0.0')`. In an event-driven async consumer, the originating HTTP request context (and its real IP) is no longer available. The event payload types (`MemberSuspendedPayload`, `MemberLockedPayload`, `SecurityAlertPayload`) do not include an `ipAddress` field. Audit logs will show `0.0.0.0` for all security and suspension events, making forensic analysis of account compromises impossible. The IP must be included in the domain event payload at the command handler level where the HTTP context is still available.

---

## 4. Cross-Context Wiring Bugs

### 4.1 notification-trigger.consumer.ts

| Event | Alert Created? | Severity |
|---|---|---|
| PublicationCreated | NO - logger.log only, no alertRepository.save | HIGH |
| DiscussionCreated | NO - Alert is constructed but save() is commented out | HIGH |
| ReactionAdded | NO - logger.log only | HIGH |
| FollowRequested | YES - fully wired | OK |
| MemberMentioned | YES - fully wired | OK |

**Root problem for DiscussionCreated**: The handler cannot identify the publication author's UserId because there is no cross-context query capability (the Content bounded context's repository is not injected). The alert object is built but save is intentionally skipped with a comment. This is not a code bug per se but a design gap: the Notification context needs either a read model of publication authors or a richer event payload from the Content context that includes the author ID.

### 4.2 block-content-filter.consumer.ts

Both event handlers (`MemberBlocked`, `MemberUnblocked`) are complete stubs. The Redis client is not injected into this consumer (only `IdempotencyStore` is in the constructor). To implement the block filter, `Redis` must be added as a constructor dependency and the SADD/SREM operations executed. Without this, the entire block/unblock feature is non-functional at the infrastructure level despite the domain aggregate implementing the behavior correctly.

### 4.3 profile-creator.consumer.ts

Fully and correctly implemented. The consumer:
- Filters for `MemberRegistered` events only
- Uses `IdempotencyStore` to prevent duplicate creation
- Checks `findByMemberId` as a secondary idempotency guard
- Creates `Profile` with `DisplayName` and `Email` value objects
- Calls `profileRepository.save(profile)`

No wiring gaps detected.

### 4.4 audit-logger.consumer.ts

All three event types are fully implemented and create + persist `AuditEntry` aggregates. The only defect is the hardcoded `0.0.0.0` IP (see BUG-015). The consumer is otherwise correctly wired.

---

## 5. Data Integrity Risks

### 5.1 Missing DB Transactions in Multi-Step Operations

**base.repository.save()** - The current count+write pattern is not wrapped in a DB transaction. The `count()` and subsequent `save()` or `qb.execute()` execute in separate DB round-trips without a transaction. If two concurrent requests save the same new aggregate simultaneously:
- Both see `count = 0`
- Both call `ormRepository.save()` (TypeORM upsert) or hit a unique constraint error
- There is no explicit serializable transaction wrapping the check-then-write

**profile-creator.consumer** - The `idempotencyStore.ensureIdempotent()` call followed by `profileRepository.findByMemberId()` and then `profileRepository.save()` involves three separate operations. If the idempotency key is set but the profile save fails, re-processing the event will see the idempotency key as already consumed and skip creation, leaving the member without a profile permanently.

### 5.2 Race Conditions in Concurrent Request Handling

**key-rotation.service.rotateKey()** - No distributed lock around the rotation sequence. If two service instances call `rotateKey()` simultaneously (e.g., scheduled task running on multiple pods), both could:
1. Read the same `currentKeyId`
2. Both set `PREVIOUS_KEY_ID_KEY = currentKeyId` (benign)
3. Both call `generateAndStoreKey()`, each setting `CURRENT_KEY_ID_KEY` to their own new key ID
4. The last writer wins, and the other new key is orphaned in Redis with no pointer, wasting the 24h TTL storage and creating a verification gap

**three-tier-cache.service.set()** - Memory write always executes after (or independently of) Redis write. In a multi-instance deployment, instance A writes to Redis and memory, instance B reads from its own memory (miss), goes to Redis (hit), promotes to its memory. This is correct. However, `deletePattern()` only clears the local memory cache. Other instances' memory caches are not invalidated. After a delete-pattern, other instances continue serving stale memory-cached values until their per-entry 30s TTL expires.

### 5.3 Optimistic Locking Implementation Assessment

The optimistic locking design in `BaseRepository` is architecturally correct once the version-routing bug is fixed:
- `UPDATE ... WHERE id = ? AND version = ?` is atomic at the DB level
- Zero affected rows → `OptimisticLockError` thrown correctly
- No separate `SELECT` before `UPDATE` (no TOCTOU window in the UPDATE path itself)

**Remaining concern**: The fix to version-based routing means a reconstituted aggregate at version 2 that is saved without any business method calls (no `incrementVersion()`) will use `previousVersion = 2 - 1 = 1` in the WHERE clause, which is correct—the DB row at version 1 will be matched. This is sound.

**Concern with `Publication.create()`**: `create()` does not call `incrementVersion()` (unlike `Member.register()` and `Group.create()` which do). After `Publication.create()`, `version = 0`. The first save will use `ormRepository.save()` (INSERT path, version <= 1), which is correct. However if domain events cause a version bump before the first save, the publication could arrive at `save()` with version = 1, which still routes to INSERT. A version-1 publication that is a DB update (theoretically impossible here but worth noting) would bypass optimistic locking.

---

## 6. Summary Risk Matrix

| Risk Area | Confirmed Bugs | Latent Bugs | Production Impact |
|---|---|---|---|
| base.repository optimistic locking | 1 (route bug) | 1 (TOCTOU race) | Data corruption under concurrent writes |
| Block/unblock feature | 1 (fully inert) | 0 | Feature completely non-functional |
| Notification wiring | 1 (3 stub handlers) | 1 (no cross-context author lookup) | 3/5 notification types never delivered |
| Key rotation auth | 0 | 2 (no TTL, non-atomic) | Auth outage on Redis flush or crash |
| JWT verification | 0 | 1 (silent error swallow) | Undebuggable auth failures |
| DLQ retry | 0 | 2 (wrong queue, O(n) scan) | Retried jobs silently discarded |
| Cache consistency | 0 | 2 (O(n) LRU, multi-instance stale) | Performance degradation, stale reads |
| Domain aggregates | 0 | 3 (memberCount, removeReaction, Map serialization) | Count drift, analytics errors |
| Audit trail | 0 | 1 (hardcoded IP) | Forensic investigation impossible |

**Total confirmed bugs**: 3  
**Total latent bug predictions**: 15  
**Critical severity**: 2 (base.repository race, block filter inert)  
**High severity**: 4 (notification stubs, key rotation atomicity x2, JWT error swallow)  
**Medium severity**: 7  
**Low severity**: 2

---

## 7. Recommended Fix Priority

1. **IMMEDIATE** - Fix `base.repository.ts` version-routing (resolves 11 failing tests + eliminates production race condition)
2. **IMMEDIATE** - Wire `BlockContentFilterConsumer` to Redis: inject Redis, call `SADD`/`SREM`
3. **HIGH** - Complete `NotificationTriggerConsumer` stubs: at minimum, enrich event payloads to include `authorId` fields so DiscussionCreated/ReactionAdded/PublicationCreated can route alerts
4. **HIGH** - Fix `KeyRotationService`: add TTL to `CURRENT_KEY_ID_KEY`, wrap rotation in Redis `MULTI/EXEC` or a distributed lock
5. **HIGH** - Add `ipAddress` field to `MemberSuspendedPayload`, `MemberLockedPayload`, `SecurityAlertPayload` event schemas so audit entries capture real IPs
6. **MEDIUM** - Fix `DeadLetterQueueService.retryDeadLetterJob` to use BullMQ's `Queue.add()` API instead of a plain Redis list push
7. **MEDIUM** - Add `version` guard to `incrementMemberCount`/`decrementMemberCount` in `Group` aggregate, and emit domain events
8. **MEDIUM** - Add `ReactionRemovedEvent` to `Publication.removeReaction()`
9. **LOW** - Replace O(n) LRU eviction in `ThreeTierCacheService` with a proper doubly-linked list implementation
10. **LOW** - Add error logging in JWT `verifyAccessToken` catch block before `continue`
