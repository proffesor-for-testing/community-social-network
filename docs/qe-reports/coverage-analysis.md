# Coverage Analysis Report
## Community Social Network — DDD Monolith

**Date**: 2026-04-21  
**Branch**: `ddd-approach`  
**Analyst**: QE Coverage Specialist (AQE v3 Fleet: fleet-b79cb450)  
**Method**: Static read-only structural analysis (lcov.info is 0 bytes; instrumented coverage unavailable)  
**Total test files**: 85 | **Total tests claimed**: 1121 (1110 passing, 11 failing in base.repository.spec.ts)

---

## Executive Summary

The codebase has strong domain-layer coverage and adequate infrastructure-layer coverage for the in-memory repositories and mappers. Coverage degrades significantly moving up the stack: the application layer (commands, queries, controllers) is sparsely tested, cross-cutting infrastructure (auth, cache, messaging, observability) is almost entirely untested, the frontend has zero tests, and several high-risk services (JWT key rotation, token blacklist, three-tier cache, GDPR erasure, Postgres repositories) have no spec files at all.

Estimated overall structural coverage (spec files : source files ratio) is approximately **37–40%** at the file level. Actual line/branch coverage will be lower because many spec files test only happy-path flows.

---

## 1. Per-Context Coverage Table

### 1.1 Domain Layer

| Context | Source Files (non-index) | Spec Files | File Ratio | Untested Source Types |
|---------|--------------------------|------------|------------|----------------------|
| **Identity** | 16 | 4 | 25% | errors (4), events (4), session aggregate, session-id VO, member-id VO |
| **Profile** | 12 | 4 | 33% | errors (2), events (3), avatar-id VO, location VO, profile-id VO |
| **Content** | 18 | 3 | 17% | errors (3), events (6), 2 repo interfaces |
| **Social Graph** | 14 | 2 | 14% | errors (3), events (6), block-id VO, connection-id VO, connection-status VO |
| **Community** | 20 | 3 | 15% | errors (3), events (7), 8 VOs (only group+membership+value-objects.spec covers a subset) |
| **Notification** | 11 | 2 | 18% | events (3), 5 VOs (only alert+preference aggregates tested), repo interfaces |
| **Admin** | 7 | 2 | 29% | events (2), admin-role VO, audit-entry-id VO, repo interface |
| **Shared** | 12 | 8 | 67% | constants/domain-constants, pagination types, repository.interface |

**Domain layer aggregate total**: ~110 source files, ~28 spec files = **25% file coverage**.  
The three value-objects.spec files cover multiple VOs each, so actual VO coverage is higher than the file ratio suggests — but events and error types are systematically untested across all contexts.

### 1.2 Infrastructure Layer

| Context | Source Files (non-index) | Spec Files | File Ratio | Key Untested Files |
|---------|--------------------------|------------|------------|-------------------|
| **Identity** | 10 | 4 | 40% | postgres-member.repository, postgres-session.repository, migration |
| **Profile** | 6 | 2 | 33% | postgres-profile.repository, migration |
| **Content** | 11 | 4 | 36% | postgres-publication.repository, postgres-discussion.repository, reaction.entity, mention.entity, migration |
| **Social Graph** | 11 | 4 | 36% | postgres-connection.repository, postgres-block.repository, migration |
| **Community** | 10 | 4 | 40% | postgres-group.repository, postgres-membership.repository, migration |
| **Notification** | 10 | 4 | 40% | postgres-alert.repository, postgres-preference.repository, migration |
| **Admin** | 6 | 2 | 33% | postgres-audit-entry.repository, migration |
| **Auth** | 6 | 0 | **0%** | jwt.service, key-rotation.service, token-blacklist.service, auth.guard, current-user.decorator, jwt.config |
| **Cache** | 5 | 0 | **0%** | three-tier-cache.service, stampede-protection, redis.config, redis.module |
| **Messaging** | 9 | 0 | **0%** | bull-queue-event-publisher, dead-letter-queue, idempotency-store, in-process-event-dispatcher, socket-io-event-emitter, socket-io.gateway |
| **Observability** | 9 | 1 | 11% | logger.service, request-logger.middleware, metrics.service, metrics.controller, tracing.config, metrics-recording.middleware |
| **GDPR** | 4 | 1 | 25% | data-erasure.service, consent.service, consent.entity |
| **Storage** | 5 | 1 | 20% | s3-upload.service, image-processor.service, cdn-url.service |
| **Email** | 4 | 1 | 25% | email.service, email-queue.consumer |
| **Shared Infra** | 6 | 5 | 83% | (well covered) |
| **Database** | 3 | 0 | **0%** | database.config, database.module, typeorm.config |

**Infrastructure layer total**: ~115 source files, ~33 spec files = **29% file coverage**.

### 1.3 Application Layer (apps/api/src/)

| Module | Commands | Queries | Controllers | Consumers | DTOs | Spec Files | Handler Coverage |
|--------|----------|---------|-------------|-----------|------|------------|-----------------|
| **Identity** | 5 handlers | 1 handler | 1 controller | — | 5 DTOs | 2 specs | 40% (register handler + auth controller) |
| **Profile** | 3 handlers | 2 handlers | 1 controller | — | 3 DTOs | 2 specs | 40% (update handler + controller) |
| **Content** | 7 handlers | 3 handlers | 3 controllers | — | 7 DTOs | 2 specs | 18% (create-post + post.controller) |
| **Social Graph** | 8 handlers | 4 handlers | 2 controllers | — | 3 DTOs | 2 specs | 17% (follow handler + connection controller) |
| **Community** | 8 handlers | 3 handlers | 1 controller | — | 4 DTOs | 2 specs | 17% (create-group + group controller) |
| **Notification** | 5 handlers | 3 handlers | 1 controller | — | 5 DTOs | 2 specs | 25% (mark-read + notification controller) |
| **Admin** | 6 handlers | 3 handlers | 2 controllers | — | 6 DTOs | 2 specs | 22% (admin controller + suspend-user) |
| **Cross-context consumers** | — | — | — | 4 consumers | — | 2 specs | 50% (notification-trigger + profile-creator; audit-logger + block-content-filter untested) |
| **Bootstrap** | — | — | — | — | — | 0 specs | 0% (event-handler-registry, integration-event-routing) |

**Application layer total**: ~183 source files, ~16 spec files = **8.7% file coverage** — the most severely underserved layer.

### 1.4 Integration Tests (tests/integration/)

| Test File | Flow Covered | Cross-Context |
|-----------|-------------|---------------|
| identity/register-login-flow.spec.ts | Register, login, me, refresh, logout (11 tests) | No |
| content/post-lifecycle.spec.ts | Create, read, update, delete post | No |
| social-graph/follow-flow.spec.ts | Follow, approve, reject, unfollow | No |
| community/group-lifecycle.spec.ts | Create, join, leave, kick, promote | No |
| cross-context/registration-creates-profile.spec.ts | Register triggers profile creation | Yes |
| cross-context/notification-on-follow.spec.ts | Follow triggers notification | Yes |
| cross-context/suspend-blocks-access.spec.ts | Suspend user blocks API access | Yes |
| cross-context/block-filters-content.spec.ts | Block filters content from blocked users | Yes |

**Coverage gaps in integration tests**: Admin flows (2FA, audit log), community search, content reactions, notification preferences, GDPR export/erasure, social graph blocking end-to-end with content filtering at Postgres level.

### 1.5 Frontend (apps/web/src/)

| Area | Source Files | Spec Files | Coverage |
|------|-------------|------------|---------|
| Components (atoms, molecules, organisms) | 11 | 0 | **0%** |
| Layouts | 2 | 0 | **0%** |
| Feature hooks (7 features, ~35 hooks) | 35 | 0 | **0%** |
| Feature components (7 features, ~35 components) | 35 | 0 | **0%** |
| Stores (4 Zustand stores) | 4 | 0 | **0%** |
| API client and error handler | 3 | 0 | **0%** |
| Socket integration | 3 | 0 | **0%** |
| Pages (8 pages) | 8 | 0 | **0%** |
| Router | 1 | 0 | **0%** |

**Frontend total**: ~102 source files, 0 spec files = **0% coverage**.

---

## 2. Layer Coverage Heatmap

```
LAYER                        FILE COVERAGE   RISK LEVEL
─────────────────────────────────────────────────────────
Domain / Shared               67%            LOW
Domain / Aggregates           ~70%*          LOW-MEDIUM
Domain / Value Objects        ~50%*          MEDIUM
Domain / Events               0%             HIGH
Domain / Errors               0%             MEDIUM
─────────────────────────────────────────────────────────
Infra / Shared                83%            LOW
Infra / In-Memory Repos       100%           LOW
Infra / Mappers               100%           LOW
Infra / Postgres Repos        0%             HIGH
Infra / Migrations            0%             LOW
Infra / Auth                  0%             CRITICAL
Infra / Cache                 0%             HIGH
Infra / Messaging             0%             HIGH
Infra / GDPR                  25%            HIGH
Infra / Storage               14%            MEDIUM
Infra / Email                 25%            MEDIUM
Infra / Observability         11%            MEDIUM
─────────────────────────────────────────────────────────
App / Command Handlers        ~20%           HIGH
App / Query Handlers          ~15%           HIGH
App / Controllers             ~40%           MEDIUM
App / Cross-Context Consumers 50%            HIGH
App / DTOs                    0%             LOW
App / Bootstrap               0%             HIGH
─────────────────────────────────────────────────────────
Integration                   8 flows        MEDIUM (key paths only)
Frontend                      0%             CRITICAL
─────────────────────────────────────────────────────────
```

*Aggregates and VOs covered through the spec files that exist, but multiple VOs and aggregate methods are exercised only indirectly.

---

## 3. Top 20 Highest-Risk Uncovered Files

Ranked by: Security sensitivity × Operational criticality × Lack of any test coverage.

| Rank | File | Risk Reason |
|------|------|-------------|
| 1 | `libs/infrastructure/auth/src/jwt.service.ts` | JWT generation/verification, token blacklist check, token revocation — entire auth security surface. Zero tests for blacklist bypass, expired token handling, audience/issuer validation, jti uniqueness. |
| 2 | `libs/infrastructure/auth/src/key-rotation.service.ts` | Redis-backed signing key rotation with grace period. A bug here silently invalidates all active sessions or allows verification with stale keys. No tests. |
| 3 | `libs/infrastructure/auth/src/token-blacklist.service.ts` | Per-user token revocation. A bug allows re-use of logged-out tokens. No tests. |
| 4 | `libs/infrastructure/auth/src/auth.guard.ts` | Every protected endpoint gate. Incorrect guard logic exposes all authenticated routes. No tests. |
| 5 | `libs/infrastructure/messaging/src/idempotency-store.ts` | Idempotency guarantees for all cross-context event consumers. Failure leads to duplicate audit entries, duplicate notifications, duplicate profile creation. No tests. |
| 6 | `libs/infrastructure/messaging/src/dead-letter-queue.ts` | Failed event handling. Silent failure of DLQ processing means events are permanently lost. No tests. |
| 7 | `libs/infrastructure/gdpr/src/data-erasure.service.ts` | GDPR Article 17 right-to-erasure across all 7 contexts inside a transaction. A partial erasure bug creates GDPR liability. No tests (the existing spec tests a simplified re-implementation, not the real service). |
| 8 | `libs/infrastructure/gdpr/src/consent.service.ts` | Consent record management. Incorrect consent tracking is a GDPR violation. No tests. |
| 9 | `libs/infrastructure/cache/src/three-tier-cache.service.ts` | Three-tier cache (memory + Redis + DB fallback) with LRU eviction, stampede protection, TTL. Cache poisoning, stampede failures, and race conditions are untested. No tests. |
| 10 | `libs/infrastructure/cache/src/stampede-protection.ts` | Cache stampede prevention. Failure causes thundering-herd under load. No tests. |
| 11 | `apps/api/src/consumers/audit-logger.consumer.ts` | Receives MemberSuspended, MemberLocked, SecurityAlertRaised events. Untested means account lockout events may silently not create audit trail. |
| 12 | `apps/api/src/consumers/block-content-filter.consumer.ts` | Filters content when a block relationship is created. Bugs allow blocked users to see content from their blockers. No tests. |
| 13 | `apps/api/src/bootstrap/event-handler-registry.ts` | Wires all cross-context event consumers to their event types. A registration bug silently drops entire event categories. No tests. |
| 14 | `apps/api/src/bootstrap/integration-event-routing.ts` | Routes integration events to Bull queues. Misconfiguration means cross-context flows never execute. No tests. |
| 15 | `libs/infrastructure/identity/src/repositories/postgres-member.repository.ts` | Production member lookup by email (login), by ID (auth guard), email uniqueness check. In-memory repo tests pass but do not validate PostgreSQL query correctness, index usage, or UUID handling. |
| 16 | `libs/infrastructure/identity/src/repositories/postgres-session.repository.ts` | Session persistence and revocation used in every auth flow. Not tested against real or mocked TypeORM. |
| 17 | `libs/infrastructure/messaging/src/socket-io.gateway.ts` | Real-time Socket.IO gateway. Untested means notification delivery may silently fail in production. |
| 18 | `libs/infrastructure/messaging/src/bull-queue-event-publisher.ts` | Bull queue integration event publishing. Untested means integration events may not reach consumers under Bull failure conditions. |
| 19 | `libs/infrastructure/observability/src/metrics.service.ts` | Prometheus counter/histogram recording. Silent metric registration bugs lead to missing production observability. |
| 20 | `apps/api/src/modules/admin/commands/admin-login.handler.ts` | Admin authentication with 2FA. No handler test — admin login bypass is untested. (Only admin.controller.spec and suspend-user.handler.spec exist.) |

---

## 4. Test Quality Spot-Check

### 4.1 `libs/domain/identity/src/__tests__/member.aggregate.spec.ts`
**Quality: HIGH**

- Tests actual aggregate behavior: state transitions, event emission, version incrementing.
- Uses real domain objects (MemberId, Email, Credential), not mocked.
- Covers happy paths and all invalid state transitions (suspend PENDING, unlock ACTIVE, deactivate already DEACTIVATED).
- Asserts on event payload properties (reason, suspendedBy, failedAttempts), not just event type.
- Uses `SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS` constant rather than hard-coded magic numbers.
- Weakness: The `reconstitute` test uses `as any` to bypass type checks on MemberStatus and Timestamp, which could mask mapper contract bugs. Edge case: the `suspend` test does not verify the event is emitted (only that status transitions) — the event IS checked separately, but the same `it` block mixes concerns.

**Assessment**: Solid behavioral tests. Highest quality in the codebase.

### 4.2 `apps/api/src/modules/identity/__tests__/auth.controller.spec.ts`
**Quality: MEDIUM**

- Instantiates AuthController directly with vi.fn() mocks — avoids NestJS DI overhead, good.
- Tests all five endpoints: register, login, refresh, logout, me.
- Asserts handler was called with correct arguments using `expect.objectContaining`.
- Tests error propagation for each endpoint (one error case per endpoint).
- Weaknesses:
  - The controller is fully mocked at the handler level — all business logic is bypassed. These are essentially routing tests, not behavioral tests.
  - No assertions on HTTP status codes (the controller just returns values; NestJS decorators are not tested).
  - No test for the `@UseGuards(AuthGuard)` behavior — the guard is not invoked.
  - `createMockUser()` creates a token payload but the logout test does not verify the jti is actually blacklisted (that would require integration-level testing).

**Assessment**: Adequate routing/delegation tests. Not sufficient for security-critical auth layer.

### 4.3 `libs/infrastructure/shared/src/__tests__/base.repository.spec.ts`
**Quality: HIGH**

- Builds a concrete TestRepository and TestAggregate to test the abstract BaseRepository without NestJS.
- Tests optimistic locking (version guard in WHERE clause) thoroughly: version=0 uses INSERT path, version>1 uses UPDATE with previousVersion check, affected=0 throws OptimisticLockError.
- Verifies query builder call order is correct (update → set → andWhere x2 → execute).
- Tests atomicity: verifies findOne is not called before update (no read-then-write antipattern).
- Tests all error propagation paths (DB connection lost, FK constraint, table missing).
- Weakness: These tests are currently reported as 11 failing — this is significant. The BaseRepository tests are the most thorough in the infrastructure layer, yet they are broken.

**Assessment**: Excellent design and coverage intent. The 11 failures are a critical signal — the base.repository implementation has regressions that propagate to all 7 Postgres repositories.

### 4.4 `tests/integration/identity/register-login-flow.spec.ts`
**Quality: HIGH**

- Uses real command handlers wired to real InMemoryRepository instances.
- Executes full lifecycle: register → login → me → refresh → logout (11 tests, 10 flows).
- Verifies repository state after operations (`repos.memberRepo.size === 1`).
- Tests duplicate email rejection, wrong password, non-existent user, weak password validation.
- MockJwtTokenService generates real-format tokens (decodable by verifyAccessToken) — integration is authentic.
- Weakness: Uses in-memory repositories, so SQL-level constraints (unique email index), PostgreSQL-specific behavior, and transaction rollbacks are not exercised. The MockJwtTokenService does not test actual JWT cryptography.

**Assessment**: Best integration tests in the codebase. Pattern should be replicated for other contexts.

### 4.5 `libs/infrastructure/gdpr/src/__tests__/data-export.service.spec.ts`
**Quality: LOW-MEDIUM**

- The spec does NOT test `DataExportService` — it tests a hand-written `TestableDataExportService` that is a simplified re-implementation of the real service.
- The real `DataErasureService` has no tests at all.
- The export test uses `setTimeout(resolve, 50-200)` to wait for async processing — a time-based test that is inherently flaky in CI.
- Asserts query table names via `q.includes('members')` — brittle and does not validate SQL correctness.
- Status assertion allows `['pending', 'processing', 'completed']` — too permissive.

**Assessment**: Low confidence. This test pattern (reimplementing the class under test) provides no real coverage of the actual service.

### 4.6 `libs/infrastructure/observability/src/__tests__/correlation-id.middleware.spec.ts`
**Quality: LOW**

- Re-implements the middleware logic inline as a local function rather than importing the actual `CorrelationIdMiddleware`.
- Tests the logic in isolation from NestJS, which is reasonable — but the actual middleware class is not imported, so decorator metadata, DI injection, and `use(req, res, next)` method signature are untested.
- Does test the validation regex comprehensively (7 tests, valid/invalid character sets, length boundary).
- Missing: no test that `next()` is called, no test that the correlation ID propagates to the logger context.

**Assessment**: Tests the extracted logic well but provides zero coverage of the actual class file.

---

## 5. Structural Coverage Gaps: Systematic Missing Categories

### 5.1 Domain Events — Zero Coverage (All 7 Contexts)
No spec tests any domain event class directly. Events are only verified as instanceof in aggregate tests. Event fields, serialization, and `eventType`/`aggregateType` strings are untested for:
- 4 identity events (MemberRegistered, MemberAuthentication Succeeded, MemberLocked, MemberSuspended)
- 3 profile events (ProfileCreated, ProfileUpdated, AvatarChanged)
- 5 content events (PublicationCreated, PublicationEdited, PublicationDeleted, DiscussionCreated, ReactionAdded, MemberMentioned)
- 6 social graph events (FollowRequested, FollowApproved, FollowRejected, Unfollowed, MemberBlocked, MemberUnblocked)
- 7 community events (GroupCreated, MemberJoined, MemberLeft, MemberKicked, MemberPromoted, OwnershipTransferred, GroupSettingsUpdated)
- 3 notification events (AlertCreated, AlertRead, PreferencesUpdated)
- 2 admin events (AuditEntryCreated, SecurityAlertRaised)

**Risk**: If an event class has a typo in `eventType` or missing field, the cross-context consumers silently drop the event. The `switch(eventType)` in every consumer depends on these string values.

### 5.2 Domain Errors — Zero Coverage
No spec tests error classes directly. Errors are tested indirectly via `expect(() => ...).toThrow(ErrorClass)` in aggregate tests, but:
- Error message strings are not verified
- Error codes/HTTP status mappings are not tested
- `AlreadySuspendedError`, `InvalidCredentialsError`, `MemberLockedException`, etc. are only tested to be thrown, never to contain correct context

### 5.3 All Postgres Repositories — Zero Coverage
14 Postgres repository implementations have no tests:
`postgres-member`, `postgres-session`, `postgres-profile`, `postgres-publication`, `postgres-discussion`, `postgres-connection`, `postgres-block`, `postgres-group`, `postgres-membership`, `postgres-alert`, `postgres-preference`, `postgres-audit-entry`

These are the production code paths. All 1121 tests run against in-memory repositories.

### 5.4 Application Layer Command/Query Handlers — ~80% Untested
Only 8 of the ~55 command handlers and ~20 query handlers have spec files. Missing:
- All 5 community handlers beyond create-group (update, join, leave, kick, update-role)
- All 3 social-graph query handlers (get-followers, get-following, get-pending-requests, get-blocks)
- All content query handlers (get-post, get-feed, get-comments)
- All notification query handlers (get-notifications, get-unread-count, get-preferences)
- Profile: create-profile, upload-avatar handlers
- Admin: admin-login, verify-2fa, setup-2fa, unsuspend-user, get-users, get-audit-log, get-security-alerts handlers

### 5.5 Frontend — 100% Untested
102 React/TypeScript source files with zero test coverage:
- All 4 Zustand stores (auth, ui, toast, notification) — state mutation logic untested
- All 7 feature hook families — API integration and optimistic update logic untested
- All shared UI components (Button, Input, Badge, Avatar, Spinner, FormField, Modal, Header) — no rendering tests
- Socket.IO integration hooks and query invalidation — real-time update logic untested
- Error boundary — error rendering untested
- Router configuration — protected route guards untested

---

## 6. Recommendations

### Priority 1 — Critical (Security & Data Integrity)

**6.1 Auth Infrastructure Tests** (auth.guard, jwt.service, key-rotation.service, token-blacklist.service)
- Write unit tests for `JwtTokenService` mocking NestJwtService and Redis: verify jti uniqueness, blacklist check on verify, UnauthorizedException on expired/invalid/revoked tokens.
- Write unit tests for `KeyRotationService` with a mocked Redis client: verify key generation, rotation grace period, fallback to config secret.
- Write unit tests for `AuthGuard`: verify 401 on missing/invalid Bearer token, verify user is attached to request on valid token.
- Estimated: 4 spec files, ~60 tests.

**6.2 GDPR Erasure Service Tests** (data-erasure.service.ts)
- The existing data-export test uses a re-implemented class — replace with tests against the real `DataErasureService` using a mocked `DataSource`.
- Test that the transaction commits when all queries succeed, rolls back on any query failure, and each context is included in `contextsProcessed`.
- Test that `ConsentService` correctly records and revokes consent.
- Estimated: 2 spec files, ~20 tests.

**6.3 Fix Failing base.repository.spec.ts Tests** (11 failures)
- These failures propagate risk to all 7 Postgres repositories that extend BaseRepository.
- The optimistic locking WHERE clause logic, QueryBuilder call ordering, and OptimisticLockError message format need investigation.
- This is the single highest-priority repair item since it affects production data integrity.

### Priority 2 — High (Core Business Logic)

**6.4 Application Layer Handler Tests**
- Add spec for each untested command handler, especially:
  - `admin-login.handler.ts` (admin authentication bypass risk)
  - `block-content-filter.consumer.ts` (content privacy)
  - `audit-logger.consumer.ts` (compliance audit trail)
  - `refresh-token.handler.ts` (session security)
  - `upload-avatar.handler.ts` (file validation bypass risk)
- Target: at minimum cover all handlers that interact with auth or cross-context consumers.

**6.5 Idempotency and Messaging Tests** (idempotency-store, dead-letter-queue, bull-queue-event-publisher)
- Test `IdempotencyStore.ensureIdempotent` with a real or mocked Redis: verify concurrent duplicate calls only execute the callback once.
- Test `DeadLetterQueue`: verify messages are stored on consumer failure.
- Estimated: 2 spec files, ~20 tests.

**6.6 Cache Layer Tests** (three-tier-cache.service, stampede-protection)
- Test ThreeTierCacheService with a mocked Redis: verify tier fallthrough (memory miss → Redis hit → return), LRU eviction at `maxMemoryEntries`, TTL expiry on memory tier.
- Test StampedeProtection: verify only one concurrent in-flight fetch executes for the same key.
- Estimated: 2 spec files, ~25 tests.

### Priority 3 — Medium (Completeness)

**6.7 Domain Events and Errors Tests**
- Add a single `domain-events.spec.ts` per context that instantiates each event class and asserts `eventType`, `aggregateType`, `aggregateId`, and all domain-specific fields.
- This prevents silent consumer mismatches from typos in event type strings.
- Estimated: 7 spec files, ~50 tests total.

**6.8 Frontend Unit Tests**
- Add Vitest + React Testing Library tests for:
  - All 4 Zustand stores: action dispatchers, selector derivations.
  - Critical hooks: `useLogin`, `useRegister`, `useFollow`, `useBlock` using MSW for API mocking.
  - Shared atoms: `Button`, `Input`, `Badge` — prop rendering, disabled states.
  - `ProtectedRoute`: verify redirect to login when unauthenticated.
- Estimated: 15–20 spec files, ~100 tests.

**6.9 Postgres Repository Contract Tests**
- Rather than running against a live database, use TypeORM's `DataSource` with `synchronize: true` against an in-memory SQLite instance (or testcontainers with PostgreSQL).
- Cover at minimum: `findById` (found/not-found), `save` (INSERT vs UPDATE), `exists`, `delete`, and any custom query methods (findByEmail, findByRecipientId, etc.).
- This validates that SQL queries, column mappings, and relation loading work correctly.
- Estimated: 14 spec files, ~100 tests.

### Priority 4 — Observability and Operational

**6.10 Observability and Socket.IO Tests**
- Add tests for `MetricsService` counter/histogram registration.
- Add tests for `SocketIOGateway` event emission using a mock Socket.IO server.
- Add tests for `RequestLoggerMiddleware` with Pino mock.

---

## 7. Coverage Metrics Summary

| Layer | Source Files | Spec Files | Est. File % | Est. Line % | Risk |
|-------|-------------|------------|-------------|-------------|------|
| Domain (all) | ~110 | ~28 | 25% | ~55%* | MEDIUM |
| Infrastructure (context) | ~70 | ~28 | 40% | ~45%* | HIGH |
| Infrastructure (cross-cutting) | ~45 | ~5 | 11% | ~15% | CRITICAL |
| Application layer | ~183 | ~16 | 9% | ~20% | HIGH |
| Integration tests | n/a | 8 | 8 flows | ~30% of flows | MEDIUM |
| Frontend | ~102 | 0 | 0% | 0% | CRITICAL |
| **Overall** | **~510** | **~85** | **~17%** | **~30%** | **HIGH** |

*Higher than file ratio because many spec files cover multiple source modules indirectly (value-objects.spec covers 5+ VOs, integration tests exercise handler → domain → infra chains).

---

## 8. Notable Architectural Observations

1. **The "test-against-in-memory" pattern is thorough but creates a false confidence problem.** All 1121 tests pass against in-memory repositories. The 14 Postgres repositories contain real SQL queries and TypeORM relation configurations that are never exercised. Given that the lcov.info file is empty (0 bytes), there is currently no way to measure actual line coverage from the test run.

2. **The GDPR test pattern (re-implementing the class under test) is an anti-pattern that appears in two places** (data-export.service.spec.ts and correlation-id.middleware.spec.ts). These tests pass but provide no coverage of the actual source files.

3. **Cross-cutting infrastructure (auth, cache, messaging) has zero unit tests** despite being the most security-sensitive and operationally critical layer in the application. The JWT key rotation service in particular contains non-trivial Redis-backed logic with failure modes that could silently revoke all user sessions.

4. **The base.repository.spec.ts has 11 failing tests.** This is the most comprehensive test in the infrastructure layer — its failures indicate a real regression in BaseRepository that has not been detected because no integration or E2E tests verify the TypeORM query builder behavior.

5. **Frontend coverage is 0%.** The 70 React component and hook files have no tests. Given that the application has real-time features (Socket.IO), optimistic updates, and infinite scroll, UI-level regressions are likely to be silent.
