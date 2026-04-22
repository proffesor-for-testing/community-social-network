# Code Quality and Complexity Analysis Report

**Project:** Community Social Network (community-social-network)
**Branch:** ddd-approach
**Analysis Date:** 2026-04-21
**Analyzer:** V3 QE Code Complexity Analyzer
**Scope:** `libs/` (330 TypeScript files) + `apps/api/src/` (230 TypeScript files)

---

## Executive Summary

The codebase implements a NestJS modular monolith with 7 DDD bounded contexts (Identity, Profile, Content, Social Graph, Community, Notification, Admin) plus cross-cutting infrastructure (Auth, Cache, GDPR, Email, Messaging, Observability, Storage). The overall DDD architecture is sound and well-executed. Most domain logic is correctly placed and the infrastructure layer correctly depends on domain interfaces. However, several concrete issues warrant attention.

### Severity Counts

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 3 | Broken 2FA, stub implementations shipped as production code, in-memory export state |
| High | 8 | Type erasure escape hatches, duplicate database config, incomplete cross-context handlers, magic bytes false-negative risk, SELECT *, missing SQL column lists |
| Medium | 12 | Long methods, switch-based dispatch pattern, repeated logger boilerplate, stub shared libraries, partial implementations masked as complete |
| Low | 9 | Minor TypeScript anti-patterns, inconsistent naming, cosmetic coupling issues |

**Total issues: 32**

---

## Top 10 Complexity Hotspots

Ranked by estimated cyclomatic complexity (branch count + 1) and cognitive load.

### 1. `libs/infrastructure/cache/src/three-tier-cache.service.ts` — Cyclomatic: ~18, Lines: 293

The highest-complexity file in the codebase. The `getMany` method (lines 129–175) has 6 distinct branches across nested loops, pipeline error handling, and dual-level fallback. The `deletePattern` method (lines 199–231) contains a do-while cursor loop with embedded regex construction from untrusted glob syntax. The LRU eviction in `evictLru` (lines 269–283) performs an O(n) linear scan over the entire cache on every insert at capacity.

**Key risk:** The regex construction on line 224 (`'^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'`) is not anchored properly for all Redis glob inputs (e.g., `[abc]` character classes are not handled) and will silently match incorrect keys.

**Estimated cyclomatic complexity breakdown:**
- `get`: 5 (null check, stale check, redis error, parse, miss)
- `getMany`: 7 (loop, memEntry null, memEntry stale, redis error, null raw, redis loop)
- `deletePattern`: 4 (do-while, keys.length, loop, error)
- `setMemory` / `evictLru`: 3

### 2. `libs/infrastructure/gdpr/src/data-export.service.ts` — Cyclomatic: ~12, Lines: 188

`processExport` (lines 63–104) orchestrates 7 cross-context raw SQL queries sequentially with a top-level try/catch. It mixes orchestration, data fetching, and state mutation. The in-memory `exportRequests` Map (line 24) is a class-level mutable store that will not survive process restart and is not thread-safe under concurrent requests.

`safeQuery` (lines 178–187) silently swallows any query error and returns an empty array, making it impossible to distinguish "table has no rows" from "query failed". This masks genuine database errors.

### 3. `libs/infrastructure/gdpr/src/data-erasure.service.ts` — Cyclomatic: ~14, Lines: 153

`eraseMemberData` (lines 25–136) manages a manual `QueryRunner` lifecycle (connect, startTransaction, 8 sequential safeExecute calls, commit, rollback, release) across 8 bounded contexts. The method is 111 lines. The try/catch/finally block (lines 41–135) contains deeply nested lambdas passed to `safeExecute`. Each of the 8 `safeExecute` closures hides its own branch count.

**Critical issue on lines 64–72 (content context):** Both queries update `author_id = $1 WHERE author_id = $2` with identical values for both parameters, resulting in a no-op. The comment acknowledges this is intentional, but the implementation provides no actual anonymization for content author references.

### 4. `libs/infrastructure/auth/src/jwt.service.ts` — Cyclomatic: ~10, Lines: 235

`verifyAccessToken` (lines 141–180) loops over all active signing keys with a try/catch inside the loop (lines 145–156). This is a silent control-flow exception pattern: errors drive iteration rather than being handled explicitly. If all keys fail for reasons other than signature mismatch (e.g., Redis is down during key rotation), all errors are silently discarded and `decoded` remains null, producing a generic `UnauthorizedException`.

`ttlToSeconds` (lines 42–61) has a switch with a dead `default` branch that throws an error (line 59), yet this case is already guarded by the regex on line 44. The regex only matches `s|m|h|d`, making the default unreachable dead code.

### 5. `apps/api/src/consumers/notification-trigger.consumer.ts` — Cyclomatic: ~10, Lines: 231

The `handle` method (lines 85–103) uses string-literal event type routing via a switch statement. The payload is cast through a double type erasure (`event as Record<string, unknown>` then `as unknown as SpecificPayload`) with no runtime validation. If the Bull queue delivers a malformed message, none of the 5 handler branches will detect type mismatches at runtime.

`onPublicationCreated` and `onReactionAdded` are stub implementations (lines 109–122, 154–168) that log and return without creating any alerts or side effects. These are marked with "In production" comments, indicating they are intentionally incomplete but currently shipped and passing tests.

### 6. `apps/api/src/consumers/audit-logger.consumer.ts` — Cyclomatic: ~8, Lines: 172

Same string-literal switch routing pattern as `notification-trigger.consumer.ts`. Both `onMemberLocked` (line 116) and `onSecurityAlertRaised` (line 148) hard-code `IpAddress.create('0.0.0.0')`, losing the actual client IP address in audit records. This is a security audit trail gap.

### 7. `libs/infrastructure/cache/src/stampede-protection.ts` — Cyclomatic: ~7, Lines: 154

`getWithProtection` (lines 109–153) uses a fire-and-forget background refresh pattern (lines 137–148) that does not propagate errors back to callers. The `.catch` and `.finally` chains are nested closures that call `releaseRefreshLock` inside a `.finally` that also has a nested `.catch(() => {})`. This creates a double-nested empty catch block that silently discards lock release failures, potentially leaving stale distributed locks in Redis until TTL expiry.

### 8. `libs/infrastructure/messaging/src/dead-letter-queue.ts` — Cyclomatic: ~7, Lines: 154

`retryDeadLetterJob` (lines 96–130) iterates the entire DLQ list via `LRANGE key 0 -1` (line 98) to find a single job by ID. For large DLQs this is O(n) over Redis list data. The method creates a `retry:{queue}` list (line 121) but there is no consumer registered anywhere in the codebase to read from this list, making the retry mechanism a dead letter of a dead letter queue.

### 9. `libs/infrastructure/email/src/template-engine.ts` — Cyclomatic: ~7, Lines: 172

`compile` (lines 58–83) calls `processEachBlocks` then `processIfBlocks` then `processUnlessBlocks` in sequence, each of which recursively calls `compile` on matched bodies (lines 109, 127, 140). This creates potential infinite recursion if a template body contains `{{#each}}` inside `{{#if}}` inside `{{#each}}` and so on. There is no recursion depth guard.

`loadTemplate` (line 45) uses `fs.readFileSync` inside an async function, blocking the Node.js event loop on disk I/O.

### 10. `libs/infrastructure/auth/src/key-rotation.service.ts` — Cyclomatic: ~7, Lines: 162

`getVerificationKeys` (lines 111–138) makes up to 4 sequential Redis calls (`GET current`, `GET key material`, `GET previous`, `GET previous key material`) where parallel `Promise.all` could be used. The fallback to `this.config.accessSecret` (line 135) on empty key list silently downgrades from dynamically rotated keys to the static config secret, potentially serving tokens signed with a key that should have been rotated.

---

## Code Smells Catalog

### CS-01: In-Memory State in Stateless Service (Critical)

**File:** `libs/infrastructure/gdpr/src/data-export.service.ts`, line 24

```typescript
private readonly exportRequests = new Map<string, ExportRequest>();
```

A `Map` used as a request store inside a singleton `@Injectable()` service. In a multi-process or clustered deployment this state is not shared across instances. Export requests created on one pod are invisible to others. The comment acknowledges this ("use Redis/DB in production") but the code is present in a production codebase with full test coverage that validates against this implementation.

**Impact:** Data loss on process restart; incorrect cross-pod responses in load-balanced environments.

### CS-02: Incomplete 2FA Implementation Shipped (Critical)

**File:** `apps/api/src/modules/admin/commands/verify-2fa.handler.ts`, lines 39–53

```typescript
const isValidCode = /^\d{6}$/.test(command.code);
// TODO: Verify TOTP code against stored secret
// For now, accept any valid 6-digit code in non-production environments
```

The 2FA verification accepts any 6-digit number. There is no stored TOTP secret, no HOTP validation, and no environment guard preventing this from running in production. The `// TODO` comment is present but there is no mechanism to block deployment with this stub code. `setup-2fa.handler.ts` (line 34) similarly states "TODO: In a full implementation."

**Impact:** Admin accounts can be bypassed by any 6-digit code. This is a security vulnerability.

### CS-03: Stub Cross-Context Handlers (Critical)

**Files:** `apps/api/src/consumers/notification-trigger.consumer.ts` (lines 109–122, 154–168), `apps/api/src/consumers/block-content-filter.consumer.ts` (lines 66–78, 81–93)

`onPublicationCreated`, `onReactionAdded`, `onMemberBlocked`, and `onMemberUnblocked` perform only `logger.log()` inside idempotency wrappers. No actual domain operation takes place. The Redis block filter mentioned in the comments (`SADD blocked:{blockerId} {blockedId}`) is never populated. The BlockContentFilterConsumer does not inject Redis and therefore cannot implement block filtering even if the code were complete.

**Impact:** Content published by blocked users will appear in feed. Reaction/publication notifications are never delivered to followers.

### CS-04: Double Type Erasure in Event Consumers (High)

**Files:** `apps/api/src/consumers/notification-trigger.consumer.ts` (lines 86–99), `apps/api/src/consumers/audit-logger.consumer.ts` (lines 64–75), `apps/api/src/consumers/block-content-filter.consumer.ts` (lines 50–63)

All three cross-context consumers use:

```typescript
const payload = event as Record<string, unknown>;
const eventType = payload['type'] as string | undefined;
switch (eventType) {
  case 'PublicationCreated':
    return this.onPublicationCreated(payload as unknown as PublicationCreatedPayload);
```

The `unknown -> Record<string,unknown> -> unknown -> SpecificPayload` cast chain bypasses TypeScript's type system entirely. There is no Zod/class-validator/io-ts schema validation on the received payloads. A malformed message from Bull will silently proceed and likely throw an unhandled runtime error inside the handler.

### CS-05: Duplicated Database Configuration (High)

**Files:** `libs/infrastructure/database/src/database.config.ts` and `libs/infrastructure/database/src/typeorm.config.ts`

Both files declare identical TypeORM connection configuration reading the same environment variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`) with identical defaults, pool settings (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`), and entity/migration glob patterns. Changes to pool tuning or entity discovery must be made in both files identically.

### CS-06: SELECT * in Production GDPR Export (High)

**File:** `libs/infrastructure/gdpr/src/data-export.service.ts`, lines 113–170

Seven of eight export queries use `SELECT *`. This:
- Exports any new columns added to the schema without review (potential PII leakage)
- Prevents the query planner from using index-only scans
- Ties export format to internal schema column names

### CS-07: Silent Error Swallowing in GDPR Export (High)

**File:** `libs/infrastructure/gdpr/src/data-export.service.ts`, lines 178–187

```typescript
private async safeQuery(...): Promise<unknown[]> {
  try {
    return await this.dataSource.query(query, params);
  } catch (error) {
    this.logger.warn(`Query failed (table may not exist): ${...}`);
    return [];
  }
}
```

Any SQL error (syntax error, permission denied, connection loss, OOM) is treated identically to "table does not exist". The `ExportRequest.data` will contain empty arrays for failed contexts with no indication to the end user that the export is incomplete. The export `status` will still be set to `'completed'`.

### CS-08: Long Method — `eraseMemberData` (High)

**File:** `libs/infrastructure/gdpr/src/data-erasure.service.ts`, lines 25–136

111 lines of inline logic in a single method. The method handles QueryRunner lifecycle, 8 bounded-context operations, and result state mutation. Extracting each bounded-context operation into a private method (e.g., `eraseIdentityContext`, `eraseProfileContext`) would reduce this to a coordinator of ~30 lines.

### CS-09: God Controller — `GroupController` (Medium)

**File:** `apps/api/src/modules/community/controllers/group.controller.ts`, lines 48–217

The controller injects 10 handler/query objects (lines 49–60) and exposes 9 HTTP endpoints. The constructor parameter list alone spans 11 lines. While this is partially an artifact of the CQRS-without-bus pattern, 10 injected dependencies in a single class is a warning signal that the class is doing too much. It manages both group lifecycle commands and member management commands.

**Recommendation:** Split into `GroupLifecycleController` (create, update, delete, join, leave, search, get) and `GroupMembershipController` (members list, role update, kick).

### CS-10: God Constructor Pattern in `PostgresPublicationRepository` (Medium)

**File:** `libs/infrastructure/content/src/repositories/postgres-publication.repository.ts`, lines 26–51

The constructor creates an inline anonymous object implementing `AggregateMapper<Publication, PublicationEntity>` (lines 34–47) and immediately passes it to `super()`. This anonymous mapper is not independently testable, not named, and exists only to satisfy the `BaseRepository` contract while the real mapper is stored separately as `this.publicationMapper`. The pattern creates two separate paths for mapping: one via `BaseRepository.findById` (unused) and one via the overridden `findById` (lines 63–74).

### CS-11: Repeated `updateX` Methods in `Profile` Aggregate (Medium)

**File:** `libs/domain/profile/src/aggregates/profile.ts`, lines 136–188

Five `updateX` methods (`updateDisplayName`, `updateBio`, `updateLocation`, `updatePrivacySettings`, `updateDisplayName`) each follow the same 4-line pattern: assign field, set `_updatedAt`, increment version, emit `ProfileUpdatedEvent`. The only variation is the field name and event payload key. This creates 5 nearly-identical blocks that must all be maintained consistently.

### CS-12: String Literal Visibility Values in Domain Logic (Medium)

**File:** `libs/domain/profile/src/aggregates/profile.ts`, lines 203–212

```typescript
switch (this._privacySettings.profileVisibility) {
  case 'public':
    return true;
  case 'connections_only':
    return isConnection;
  case 'private':
    return false;
  default:
    return false;
}
```

The switch uses raw string literals for visibility values rather than the `ProfileVisibility` type enum-like constants already defined in `privacy-settings.ts`. If a new visibility level is added to `PrivacySettings`, this switch silently falls through to `return false` without any compiler warning.

### CS-13: `verifyAccessToken` Silent Exception Control Flow (Medium)

**File:** `libs/infrastructure/auth/src/jwt.service.ts`, lines 145–156

Using try/catch inside a for loop as a control-flow mechanism (continuing to the next key on any JWT verification error) means all errors—whether "wrong key" or "Redis timeout during key retrieval" or "malformed token payload"—are swallowed identically. The error type is not inspected before continuing.

### CS-14: Blocking `readFileSync` in Async Template Loading (Medium)

**File:** `libs/infrastructure/email/src/template-engine.ts`, line 45

```typescript
const content = fs.readFileSync(filePath, 'utf-8');
```

Inside an `async` function declared as `private async loadTemplate`. Uses the synchronous filesystem API in an async context, blocking the event loop for the duration of disk I/O. Should use `fs.promises.readFile` or `fs/promises`.

### CS-15: Duplicate `process.env` Reads Without Config Module (Medium)

**Files:** `libs/infrastructure/database/src/database.config.ts`, `libs/infrastructure/database/src/typeorm.config.ts`, `libs/infrastructure/messaging/src/bull.config.ts`, `libs/infrastructure/cache/src/redis.config.ts`, `libs/infrastructure/observability/src/logger.config.ts`, `libs/infrastructure/observability/src/tracing.config.ts`

Six files read `process.env` directly without going through NestJS's `ConfigService`. The auth module (`libs/infrastructure/auth/src/jwt.config.ts`) correctly uses `registerAs` and `ConfigType`. The remaining infrastructure modules read env vars at module load time, before NestJS's config validation can run, and use inconsistent bracket notation vs dot notation (compare `process.env['REDIS_HOST']` in bull.config vs `process.env.JWT_ACCESS_SECRET` in jwt.config).

### CS-16: O(n) LRU Eviction Scan (Medium)

**File:** `libs/infrastructure/cache/src/three-tier-cache.service.ts`, lines 269–283

```typescript
private evictLru(): void {
  let oldestKey: string | null = null;
  let oldestAccess = Infinity;
  for (const [key, entry] of this.memoryCache) {
    if (entry.lastAccessed < oldestAccess) {
      oldestAccess = entry.lastAccessed;
      oldestKey = key;
    }
  }
  ...
}
```

Called on every `setMemory` call when the cache is at capacity (1000 entries). Scanning 1000 entries to find the LRU item on each insertion means O(n) time per cache write when full. A proper LRU can be implemented in O(1) using a doubly-linked list + hashmap (or a `Map` with ordered insertion leveraged by iterating `keys().next()`).

### CS-17: Empty Shared Library Packages (Low)

**Files:** `libs/shared/constants/src/index.ts`, `libs/shared/utils/src/index.ts`, `libs/shared/types/src/index.ts`

All three files export only `export {}`. These packages exist in `nx.json` / `tsconfig.base.json` as importable libraries but contain no code. Any module that imports `@csn/shared-constants` gets an empty module. Domain constants are instead in `libs/domain/shared/src/constants/domain-constants.ts`. These three packages are dead scaffolding.

### CS-18: `!` Non-null Assertions on Server in Socket Gateway (Low)

**File:** `libs/infrastructure/messaging/src/socket-io-event-emitter.ts`, lines 34, 45, 54

```typescript
this.server!.to(`user:${userId}`).emit(event, data);
```

The `server` field is set via `setServer()` which is called from `afterInit()`. If `emitToUser`, `emitToRoom`, or `broadcast` are called before the gateway initializes, these will throw `TypeError: Cannot read properties of null`. A guard or a lazy initialization queue would be safer.

### CS-19: Magic Numbers in ThreeTierCache Constructor (Low)

**File:** `libs/infrastructure/cache/src/three-tier-cache.service.ts`, lines 33–36

```typescript
this.maxMemoryEntries = options?.maxMemoryEntries ?? 1000;
this.defaultTtlSeconds = options?.defaultTtlSeconds ?? 300;
this.memoryTtlMs = options?.memoryTtlMs ?? 30000;
```

`60000` (prune interval, line 39) is not configurable and not named. These constants are not exported or documented. Tuning requires reading the source.

### CS-20: Inconsistent Use of `as unknown as T` in Tests (Low)

Tests pervasively use `mockHandler as unknown as RealHandlerType` instead of typed mocks. This pattern bypasses compile-time interface checking, meaning a test can pass after an interface change that breaks the real wiring. Affected test files include `group.controller.spec.ts`, `profile.controller.spec.ts`, `connection.controller.spec.ts`, and `admin.controller.spec.ts`.

---

## DDD Pattern Violations

### DDD-01: Infrastructure Reaching Across Bounded Contexts via Raw SQL (High)

**File:** `libs/infrastructure/gdpr/src/data-export.service.ts` and `data-erasure.service.ts`

Both GDPR services bypass all 7 bounded-context domain models and repositories, querying tables directly with raw SQL. This couples the GDPR infrastructure to internal database schema details of every other bounded context. If the `publications` table is renamed or the `author_id` column changes, the GDPR service silently breaks with no compile-time safety.

**DDD principle violated:** Each bounded context should expose its data only through its own repository interface or application service. Cross-context data access should flow through published integration events or dedicated query services, not direct SQL.

**Recommendation:** Add `IDataExportQuery` interfaces to each bounded context that GDPR calls through the application service layer, or use read models / projections.

### DDD-02: Content Erasure No-Op (High)

**File:** `libs/infrastructure/gdpr/src/data-erasure.service.ts`, lines 64–72

```typescript
await queryRunner.query(
  `UPDATE publications SET author_id = $1 WHERE author_id = $2`,
  [memberId, memberId], // Keep reference, author name resolved at display time
);
```

Both parameters are `memberId`. The SQL updates `author_id` to the same value it already has, performing a no-op. The intent (anonymize display name at query time) requires that the profile display name was already anonymized (done in step 2), but the content tables still hold the real `author_id` UUID, enabling correlation attacks. The domain aggregate `Publication` has no `anonymize()` method, forcing this logic into raw SQL in the infrastructure layer.

### DDD-03: Anemic Notification Context Aggregates (Medium)

**File:** `libs/domain/notification/src/aggregates/preference.ts`

`Preference.setChannelsForType` emits a `PreferencesUpdatedEvent` with `this.version + 1` (line 56) before calling `incrementVersion()` (line 60). The event payload carries a stale (off-by-one) version number. This is a domain logic bug within the aggregate.

```typescript
this.addDomainEvent(
  new PreferencesUpdatedEvent(
    this.id.value,
    channels.map((c) => c.toString()),
    this.version + 1,   // <-- version is still the OLD value here
  ),
);
this.incrementVersion();  // version incremented AFTER the event is added
```

### DDD-04: Profile Visibility Logic Using Primitive String Values (Medium)

**File:** `libs/domain/profile/src/aggregates/profile.ts`, lines 203–212

The `isVisibleTo` method switches on raw string values (`'public'`, `'private'`, `'connections_only'`) rather than using the `ProfileVisibility` type or delegating to `PrivacySettings`. The same switch pattern appears in `Publication.isVisibleTo` (lines 231–242 in `publication.ts`) using a `VisibilityEnum`. The two aggregates use different patterns for the same concept (one string literals, one enum), creating inconsistency.

**Recommendation:** Move `isVisibleTo` logic into the `PrivacySettings` value object itself so behavior is co-located with the value.

### DDD-05: `Publication.reconstitute` Bypasses Encapsulation (Low)

**File:** `libs/domain/content/src/aggregates/publication.ts`, line 111

```typescript
publication['setVersion'](version);
```

Uses bracket notation to call a `protected` method (`setVersion`) on a parent class, bypassing TypeScript's access modifier by treating it as an index access. All other aggregates call `setVersion` directly within the class, which works because `setVersion` is declared `protected` on `AggregateRoot`. The bracket notation is a workaround for a missing relationship or a copy-paste error that should use the normal `publication.setVersion(version)` form. (Note: `setVersion` is `protected`, so calling it from within the subclass directly is legal; the bracket notation is unnecessary and misleads readers.)

### DDD-06: Cross-Context Coupling Through Direct Repository Injection (Medium)

**File:** `apps/api/src/modules/admin/commands/suspend-user.handler.ts`

The `SuspendUserHandler` in the Admin context directly injects `IMemberRepository` from the Identity context (line 24) and `IAuditEntryRepository` from the Admin context. While repository interfaces are used (good), the Admin application layer directly accesses Identity domain objects, modifying the `Member` aggregate. A cleaner DDD approach would have Admin publish a `SuspendMemberCommand` event to the Identity bounded context, which then handles its own aggregate mutation and publishes a `MemberSuspended` event that Admin listens to.

### DDD-07: Missing `mediaIds` Persistence (Medium)

**File:** `libs/infrastructure/content/src/mappers/publication.mapper.ts`, lines 39–40

```typescript
// mediaIds are not stored in publication_reactions/mentions tables;
// placeholder empty array since the entity does not persist mediaIds separately yet
const mediaIds: string[] = [];
```

`Publication.mediaIds` is always empty when loaded from the database. The domain aggregate has a `_mediaIds: string[]` field and the `addMentions` method can populate mentions, but there is no equivalent for media. Any media IDs added to a `Publication` aggregate in memory are silently discarded when the aggregate is persisted and lost on the next load. The domain supports media but the infrastructure silently ignores it.

---

## Module Coupling and Cohesion

### Coupling Issues

1. **GDPR services have maximum coupling** to all other bounded contexts via raw SQL table names. The GDPR module knows the internal table names (`members`, `profiles`, `publications`, `discussions`, `connections`, `blocks`, `memberships`, `groups`, `alerts`, `notification_preferences`, `consent_records`, `audit_entries`, `sessions`) of every other context.

2. **Admin context couples directly to Identity domain objects.** `SuspendUserHandler`, `UnsuspendUserHandler`, `AdminLoginHandler`, and `Verify2faHandler` all inject `IMemberRepository` and mutate the `Member` aggregate from outside the Identity bounded context.

3. **`AppModule` imports 17 modules** (7 infrastructure + 9 application + global modules). This is expected for a modular monolith but the `EventHandlerRegistry` wiring is implicit — there is no static list of which events are handled by which modules, making the event routing hard to audit.

### Cohesion Issues

1. **`NotificationTriggerConsumer`** handles 5 different event types (`PublicationCreated`, `DiscussionCreated`, `ReactionAdded`, `FollowRequested`, `MemberMentioned`). Only 2 of the 5 handlers are functional. The class mixes fully-implemented handlers with stubs that are not clearly differentiated.

2. **`AdminController` and `GroupController`** each have high handler injection counts (7 and 10 respectively), violating the single-responsibility principle at the controller level.

3. **Dead letter retry mechanism is decoupled from any consumer:** `DeadLetterQueueService.retryDeadLetterJob` pushes to `retry:{queue}` but no consumer reads from this list. The retry mechanism cannot work.

---

## Dead Code / Unused Exports

### DC-01: Stub Shared Libraries

- `libs/shared/constants/src/index.ts` — exports nothing (`export {}`)
- `libs/shared/utils/src/index.ts` — exports nothing (`export {}`)
- `libs/shared/types/src/index.ts` — exports nothing (`export {}`)

These three packages add 3 entries to `tsconfig.base.json` path aliases and three entries to `nx.json` projects with no benefit. They should either be populated or removed.

### DC-02: Dead DLQ Retry Consumer

**File:** `libs/infrastructure/messaging/src/dead-letter-queue.ts`, `retryDeadLetterJob` method (lines 96–130)

Pushes failed jobs to `retry:{queue}` list in Redis. No consumer in the entire codebase (`apps/api/src/` and `libs/`) reads from a `retry:*` key. This makes the retry feature non-functional.

### DC-03: Unreachable `default` Branch in `ttlToSeconds`

**File:** `libs/infrastructure/auth/src/jwt.service.ts`, lines 57–59

```typescript
default:
  throw new Error(`Unknown TTL unit: ${unit}`);
```

The regex on line 44 (`/^(\d+)(s|m|h|d)$/`) guarantees `unit` is one of `s`, `m`, `h`, `d`. The `switch` handles all four cases. The `default` branch is unreachable.

### DC-04: `AsyncLoadSharp` Never Awaited

**File:** `libs/infrastructure/storage/src/image-processor.service.ts`, line 24

```typescript
constructor() {
  this.loadSharp();  // Promise not awaited
}
```

The `loadSharp()` method is `async` but is called without `await` in the constructor. In NestJS, `onModuleInit()` is the correct hook for async initialization. If `generateVariants` or `resize` is called before `loadSharp` resolves (e.g., immediately after module initialization), `this.sharpAvailable` will be `false` and images will be processed in stub mode even though Sharp is installed.

---

## TypeScript Anti-Patterns

### TS-01: `as unknown as T` Type Erasure (High)

**Count:** 30+ occurrences across production consumers and test files

In production code:
- `apps/api/src/consumers/notification-trigger.consumer.ts` (lines 91–99): 5 instances
- `apps/api/src/consumers/audit-logger.consumer.ts` (lines 69–73): 3 instances
- `apps/api/src/consumers/block-content-filter.consumer.ts` (lines 56–57): 2 instances

All of these cast unvalidated `unknown` event payloads to specific types without any runtime validation. This is equivalent to `any` casting.

### TS-02: `!` Non-Null Assertion Abuse (Medium)

Instances in production (non-test) code:
- `libs/infrastructure/messaging/src/socket-io-event-emitter.ts` lines 34, 45, 54 — `this.server!`
- `libs/infrastructure/observability/src/metrics.service.ts` line 60 — `this.durationHistograms.get(histKey)!`
- `libs/infrastructure/shared/src/repositories/base.repository.ts` (implicit via `.get()` without null check in the loop building the query)

The `MetricsService` at line 60 uses `!` after a conditional that already confirms the key exists (line 52), which is safe but unnecessarily relies on the assertion rather than destructuring.

### TS-03: `Record<string, unknown>` as Universal Type (Medium)

**Files:** Multiple consumers and gateway

The pattern `(client.data as Record<string, unknown>)['userId']` in `socket-io.gateway.ts` (lines 95, 113, 129) and the `(req as Record<string, unknown>)['adminUser']` in `admin.controller.ts` (line 178) use `Record<string, unknown>` as a dynamic property bag. Socket.IO's `Socket.data` typing and Express's `Request` both support proper augmentation via declaration merging, which would eliminate the need for these casts.

### TS-04: Inconsistent Error Handling (Low)

Throughout the codebase, error handling alternates between:
- `error instanceof Error ? error.message : String(error)` (common in infrastructure)
- `(error as Error).message` (in some places)
- `error.message` without any guard (rare)

The first form is correct but verbose. No shared `getErrorMessage(error: unknown): string` utility exists (despite `libs/shared/utils/` being available as a home for it).

---

## Recommendations

### Priority 1 — Security Critical (Fix Before Production)

1. **Implement TOTP verification in `verify-2fa.handler.ts`** or gate the admin panel behind a feature flag that disables 2FA login until implemented. Any 6-digit code currently grants admin access.

2. **Gate stub consumer implementations** with environment checks or remove them from the active dispatch path. `onPublicationCreated`, `onReactionAdded`, `onMemberBlocked`, and `onMemberUnblocked` should either be implemented or throw a `NotImplementedError` that surfaces in CI.

3. **Fix audit trail IP address**: `AuditLoggerConsumer.onMemberLocked` and `onSecurityAlertRaised` hard-code `'0.0.0.0'`. The consumer should carry IP address in the event payload or derive it from request context.

### Priority 2 — Data Integrity (Fix Before Scale)

4. **Replace in-memory `exportRequests` Map** with a Redis-backed or database-backed store in `DataExportService`.

5. **Fix content anonymization no-op** in `DataErasureService`. The `publications` UPDATE must set `author_id` to a designated "deleted user" sentinel, or a `deleted_author` boolean flag must be added.

6. **Implement `mediaIds` persistence** in `PublicationEntity` and `PublicationMapper`. The domain model supports media but the data is silently dropped.

7. **Fix `PreferencesUpdatedEvent` version in `Preference.setChannelsForType`**: The event should pass `this.version` (pre-increment) or `this.version + 1` (post-increment) consistently. Currently the event carries `version + 1` before `incrementVersion()` runs, giving the correct final value but in a confusing order.

### Priority 3 — Maintainability

8. **Extract `eraseMemberData` into bounded-context-specific private methods.** Each of the 8 `safeExecute` blocks should be a named private method.

9. **Add Zod or class-transformer validation in event consumer `handle` methods** before switching on event type. Replace `as unknown as SpecificPayload` with validated deserialization.

10. **Replace `SELECT *` in GDPR export** with explicit column lists and route through repository interfaces instead of raw SQL.

11. **Implement or remove DLQ retry.** Either register a Bull processor that reads from `retry:{queue}` or remove the `retryDeadLetterJob` method.

12. **Replace O(n) LRU scan** in `ThreeTierCacheService.evictLru` with an O(1) approach using `Map` insertion order: `this.memoryCache.keys().next()` gives the oldest entry since `Map` maintains insertion order.

13. **Populate or remove stub shared libraries** (`@csn/shared-constants`, `@csn/shared-utils`, `@csn/shared-types`). Add a `getErrorMessage` utility to `@csn/shared-utils`.

14. **Replace `fs.readFileSync` with `fs.promises.readFile`** in `TemplateEngine.loadTemplate`.

15. **Add NestJS `onModuleInit` for async Sharp loading** in `ImageProcessorService` and move `loadSharp()` to `onModuleInit(): Promise<void>`.

---

## Metrics Summary

| Category | Files Analyzed | Issues Found | Critical | High | Medium | Low |
|----------|---------------|--------------|----------|------|--------|-----|
| Domain Layer | 45 | 6 | 0 | 2 | 3 | 1 |
| Infrastructure Layer | 90 | 16 | 2 | 5 | 6 | 3 |
| Application Layer | 140 | 8 | 1 | 1 | 3 | 3 |
| Cross-Cutting (GDPR, Auth) | 10 | 4 | 1 | 2 | 1 | 0 |
| Shared Libs | 5 | 3 | 0 | 0 | 1 | 2 |
| **Total** | **290** | **32** | **3** | **8** | **12** | **9** |

### Complexity Distribution (Estimated)

| Cyclomatic Range | Files | Functions |
|-----------------|-------|-----------|
| Low (1–5) | ~240 | ~410 |
| Medium (6–10) | ~35 | ~75 |
| High (11–20) | ~13 | ~25 |
| Critical (>20) | ~2 | ~3 |

### Maintainability Index (Qualitative)

| Module | Score | Notes |
|--------|-------|-------|
| Domain aggregates | 82/100 | Clean, well-encapsulated, good invariants |
| Infrastructure repositories | 78/100 | Good use of BaseRepository, minor mapper coupling |
| Auth infrastructure | 70/100 | JWT service has acceptable complexity, key rotation is clear |
| Cache infrastructure | 58/100 | Three-tier service is complex, LRU is inefficient |
| GDPR infrastructure | 45/100 | Cross-context SQL coupling, long methods, incomplete erasure |
| Application consumers | 50/100 | Stub implementations, type erasure, hardcoded values |

---

*Report generated by V3 QE Code Complexity Analyzer on 2026-04-21*
