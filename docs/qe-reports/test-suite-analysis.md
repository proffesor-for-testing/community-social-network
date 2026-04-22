# Test Suite Analysis Report
**Project**: Community Social Network  
**Date**: 2026-04-21  
**Reviewer**: V3 QE Performance Reviewer (chaos-resilience domain)  
**Scope**: All 85 spec files across `libs/`, `apps/`, and `tests/`

---

## 1. Test Structure and Organization

### 1.1 Distribution by Layer and Type

| Layer | Spec Files | Approximate Test Cases | Type |
|-------|-----------|----------------------|------|
| Domain (`libs/domain/**`) | 28 | ~350 | Unit |
| Infrastructure (`libs/infrastructure/**`) | 33 | ~480 | Unit (in-memory repos) |
| Application handlers (`apps/api/src/modules/**`) | 16 | ~130 | Unit (mocked repos) |
| Cross-cutting consumers (`apps/api/src/consumers/**`) | 2 | ~25 | Unit |
| Integration tests (`tests/integration/**`) | 8 | ~76 | Integration (in-memory DI) |
| **Total** | **87** | **~1,061** | |

Note: The project memory document cites 1,121 total tests. The spec file count in the repository adds up to approximately 85-87 files; the discrepancy is explained by some spec files containing more test cases than can be easily counted without executing them.

### 1.2 Test Topology

The integration tests in `tests/integration/` are not true database integration tests. They use in-memory repository implementations (`InMemoryMemberRepository`, `InMemoryConnectionRepository`, etc.) rather than a live PostgreSQL instance. This is a reasonable approach for CI speed but means the actual SQL queries, TypeORM entity mapping, index utilization, and constraint enforcement are **never tested**.

The spec file tree is well organized:
- Domain logic tests are co-located under `libs/domain/<context>/src/__tests__/`
- Infrastructure mapper and in-memory repository tests live under `libs/infrastructure/<context>/src/__tests__/`
- Application handler and controller tests live under `apps/api/src/modules/<context>/__tests__/`
- Cross-context flows are under `tests/integration/cross-context/`

---

## 2. Test Distribution by Bounded Context

| Bounded Context | Domain Tests | Infra Tests | Handler Tests | Controller Tests | Integration Tests |
|----------------|-------------|------------|--------------|-----------------|-----------------|
| Identity | 4 | 4 | 1 | 1 | 1 |
| Profile | 4 | 2 | 1 | 1 | 0 |
| Content | 3 | 4 | 1 | 1 | 1 |
| Social Graph | 2 | 4 | 1 | 1 | 1+2 cross-ctx |
| Community | 3 | 4 | 1 | 1 | 1 |
| Notification | 2 | 4 | 1 | 1 | 1 cross-ctx |
| Admin | 2 | 2 | 1 | 1 | 0 |
| Shared/Cross-cutting | 8 | 6 | 2 consumers | — | — |

**Coverage gaps by context**: Admin and Profile contexts have no integration test coverage. The admin context contains complex business logic (2FA setup, suspension workflows) that is only exercised at unit level with mocked dependencies.

---

## 3. Test Quality Issues

### 3.1 Over-Mocking in Controller Tests

**Files**: `apps/api/src/modules/*/controllers/*.spec.ts`

All controller tests use a pattern that mocks the entire `CommandBus` and `QueryBus` with `vi.fn()`:

```typescript
commandBusExecute = vi.fn();
const commandBus = { execute: commandBusExecute } as any;
controller = new PostController(commandBus, queryBus);
```

This means controller tests verify only that:
1. The controller calls `commandBus.execute` once.
2. The correct command/query object type is passed.
3. The controller returns whatever the mock returns.

They do not verify DTO validation behavior, HTTP status codes, authentication guard interaction, or error mapping. A controller that calls `execute` with the wrong command type would pass these tests as long as `execute` is called once.

**Specific gap**: `post.controller.spec.ts` tests `updatePost` but does not test the case where `content` is empty string or exceeds max length — validation is handled by `class-validator` decorators on DTOs which are bypassed when the controller is instantiated directly without NestJS's `ValidationPipe`.

---

### 3.2 Missing Assertions on Domain Events

**Files**: `libs/domain/*/src/__tests__/*.spec.ts`

The integration test `tests/integration/content/post-lifecycle.spec.ts:143-158` contains this comment and test:

```typescript
// The AddReaction handler modifies the aggregate's in-memory reaction counts...
// We verify the handler executes successfully (no throw = reaction accepted).
await expect(
  commandBus.execute(new AddReactionCommand(...)),
).resolves.not.toThrow();
```

The test acknowledges that reaction count persistence is not verified because the in-memory mapper round-trip does not preserve aggregate-level counts. This is technically correct (reactions are stored in a separate `ReactionEntity` table), but it means the test does not verify that the reaction was actually persisted — only that no exception was thrown. A silent failure in `save()` would pass this test.

Similarly, in `create-post.handler.spec.ts:93-107`, the test calls `savedPublication!.pullDomainEvents()` which both reads and clears the event list. If this test runs before another test that needs to check domain events on the same object, the events will already be cleared. In this file the pattern is safe because `savedPublication` is reset in `beforeEach`, but the pattern is brittle.

---

### 3.3 Happy Path Dominance in Integration Tests

**Files**: `tests/integration/**/*.spec.ts`

The integration test files follow a consistent "happy path + one or two error cases" pattern. Missing scenarios include:

**Identity flow** (`register-login-flow.spec.ts`):
- No test for account lockout after N failed login attempts
- No test for `status = 'SUSPENDED'` blocking login (the handler has this branch at line 34, but the test suite only tests wrong password and non-existent email)
- No test for concurrent registration with the same email (race condition)

**Content lifecycle** (`post-lifecycle.spec.ts`):
- No test for updating a post with content that exceeds the maximum length
- No test for `CONNECTIONS_ONLY` or `PRIVATE` visibility access control
- No test for removing a reaction that was never added
- No test for adding a reaction after deletion (post with status `DELETED`)

**Social graph flow** (`follow-flow.spec.ts`):
- No test for the mutual-follow approval workflow (approve/reject)
- No test for following a user who has already blocked the requester

**Community lifecycle** (`group-lifecycle.spec.ts`):
- No test for group member count consistency after multiple join/leave operations
- No test for joining a private group (requires approval)

---

### 3.4 Brittle Test in RegisterMemberHandler Spec

**File**: `apps/api/src/modules/identity/__tests__/register-member.handler.spec.ts:157-173`

```typescript
it('should handle case-insensitive email matching', async () => {
  const command1 = new RegisterMemberCommand('user@example.com', 'User One', 'Str0ng!Pass#2024');
  await handler.execute(command1);
  const command2 = new RegisterMemberCommand('USER@EXAMPLE.COM', 'User Two', 'Str0ng!Pass#2024');
  await expect(handler.execute(command2)).rejects.toThrow(ConflictException);
});
```

This test works because `InMemoryMemberRepository.findByEmail` normalizes the lookup. However, the test description says "Email VO normalizes to lowercase" — but if the `Email` value object's normalization behavior changes, or if the test ran against `PostgresMemberRepository` where case sensitivity depends on PostgreSQL collation settings, this test could behave differently. The test asserts behavior that depends on implementation details of two collaborators simultaneously.

---

### 3.5 No Tests for GDPR, File Storage, or Email Infrastructure

**Files checked**: `libs/infrastructure/gdpr/src/__tests__/`, `libs/infrastructure/storage/src/__tests__/`, `libs/infrastructure/email/src/__tests__/`

`data-export.service.spec.ts` exists for GDPR. However, `DataErasureService` — the right-to-erasure implementation — has no dedicated test file. This is a compliance-critical path.

The storage magic bytes validator has a test (`magic-bytes-validator.spec.ts`), but the `S3StorageService` and `ImageProcessingService` have no tests.

The email template engine has a test (`template-engine.spec.ts`), but the `EmailQueueConsumer` (which processes the Bull queue) has no test.

---

## 4. Test Isolation Issues

### 4.1 Shared `randomUUID()` constants at describe-scope

**Files**: `tests/integration/content/post-lifecycle.spec.ts:50-51`  
`tests/integration/cross-context/block-filters-content.spec.ts:59-60`

```typescript
const authorId = randomUUID();
const otherUserId = randomUUID();
```

These constants are defined at `describe` block scope, meaning they are generated once when the test file is first evaluated. All test cases in the describe block share the same `authorId`. This is intentional for the current test structure (each `it` block starts with fresh in-memory repos via `beforeEach`), but it means test isolation depends on `createTestRepositories()` returning truly fresh instances. If any future test modifies a shared repository without resetting it, the fixed UUIDs will cause unexpected interactions.

**Cleaner pattern**: Define test identities inside `beforeEach` or use constants clearly labeled as test fixtures.

---

### 4.2 NestJS TestingModule teardown not called

**File**: `tests/integration/content/post-lifecycle.spec.ts:56-74`

The test creates a `TestingModule` in `beforeEach` but has no `afterEach` that calls `module.close()`. NestJS modules may hold open database connections, timers, or Bull queue instances. Without explicit teardown, these can bleed across tests and potentially cause resource warnings in CI.

---

### 4.3 `bcrypt` mock leaks across test files

**File**: `apps/api/src/modules/identity/__tests__/register-member.handler.spec.ts:11-18`

```typescript
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));
```

Vitest module mocks declared with `vi.mock` at the top level are hoisted and apply for the entire test file. If other tests in the same Vitest worker process depend on real `bcrypt` behavior (e.g., `tests/integration/identity/register-login-flow.spec.ts`), they may be affected depending on module cache isolation. The integration test file imports `bcrypt` indirectly through `register-member.handler.ts`, so there is a potential for the mock to contaminate integration tests run in the same worker.

The integration test's `MockJwtTokenService` returns deterministic tokens which correctly simulates JWT without real signing, but real `bcrypt.hash` IS called in the integration test (no mock is applied there). The `vitest.config.ts` at root uses `globals: true` and does not explicitly enable `isolateModules`, meaning worker-level module caches may be shared. This should be verified.

---

## 5. Missing Test Scenarios by Domain

### 5.1 Identity (HIGH priority gaps)

- Account lockout threshold enforcement (after N failed logins)
- `SUSPENDED` and `DEACTIVATED` status rejection on login
- Token refresh with an expired refresh token
- Token refresh with a revoked session
- Concurrent duplicate registration (race condition)
- `logout` called twice with the same token

### 5.2 Content (HIGH priority gaps)

- Visibility enforcement: a `PRIVATE` post is not returned in another user's query
- `CONNECTIONS_ONLY` posts filtering for non-connected users
- Post content maximum length validation
- Reaction deduplication (adding the same reaction type twice)
- Comment on a deleted post
- Thread depth limits (if any)

### 5.3 Social Graph (HIGH priority gaps)

- Follow request approved/rejected cycle
- Blocking a user who is already followed removes the connection
- Cannot follow a user who has blocked you
- Cannot follow yourself (self-follow guard)
- Unblock a user who was never blocked

### 5.4 Community (MEDIUM priority gaps)

- Join a private group (requires approval flow)
- Member count consistency: `group.memberCount` is a denormalized field on `GroupEntity`; no test verifies it stays in sync after join/leave/kick operations
- Kick the last admin of a group (edge case)
- Non-admin attempting to kick/update roles

### 5.5 Admin (HIGH priority gaps — compliance risk)

- 2FA setup and verification full flow (only basic tests exist)
- Admin login brute force lockout
- Suspension of a user who is currently logged in (should invalidate sessions)
- Audit log immutability enforcement (the `PostgresAuditEntryRepository` throws on update/delete, but this behavior has no integration test)

### 5.6 Notification (MEDIUM priority gaps)

- `markAllRead` for a user with zero unread notifications
- Notification delivery when the author's post triggers followers (the `onPublicationCreated` handler currently only logs — the code path is untested for actual alerting)
- Preference update and subsequent filtering of notification types

---

## 6. Slow Test Patterns

### 6.1 Integration tests that call real bcrypt

**File**: `tests/integration/identity/register-login-flow.spec.ts`

This integration test calls `MockJwtTokenService.verifyAccessToken` which decodes the mock token format. However, `RegisterMemberHandler` calls `bcrypt.hash` with cost factor 12, and `LoginMemberHandler` calls `bcrypt.compare`. In this test file there is no `vi.mock('bcrypt')`. Each registration + login test case in this file incurs ~200-400ms of bcrypt computation.

The test file has 11 test cases, most of which register at least one user. Estimated test time: 11 × ~300ms = ~3-4 seconds for this one file. Over time as more tests are added this will be noticeable.

**Recommended fix**: Mock bcrypt in integration tests (using `vi.mock` at the describe level, or use a shared `MockHashingService` injected via the test infrastructure, similar to how `MockJwtTokenService` is already implemented).

---

### 6.2 `beforeEach` creates full NestJS TestingModule in content integration test

**File**: `tests/integration/content/post-lifecycle.spec.ts:56-74`

```typescript
beforeEach(async () => {
  module = await Test.createTestingModule({ ... }).compile();
  await module.init();
  ...
});
```

`Test.createTestingModule().compile()` + `module.init()` takes ~100-300ms even with lightweight providers. With 8 tests in the describe block, this adds ~1-2 seconds of setup overhead per test run. Consider using `beforeAll` for the module compilation and resetting only the in-memory repositories in `beforeEach`.

---

## 7. Coverage Blind Spots by Domain

### 7.1 PostgreSQL repository implementations — zero test coverage

All `Postgres*Repository` classes in `libs/infrastructure/*/src/repositories/postgres-*.repository.ts` have no test coverage. The entire TypeORM integration layer is untested:

- `PostgresPublicationRepository` — the `mentions` replace-on-save pattern
- `PostgresAuditEntryRepository` — the immutability enforcement (`delete` throws)
- `PostgresAlertRepository.countUnread` — composite index usage
- `BaseRepository.save` — the optimistic lock via QueryBuilder (tested with mocks, but never against real TypeORM)

The in-memory repository tests confirm the domain contract but do not verify that TypeORM entity mapping, column type coercion, and constraint enforcement work correctly.

---

### 7.2 Application query handlers — 47 of 54 have no direct test

As enumerated in the handler coverage analysis, only 7 of 54 handler files have a dedicated spec. The untested handlers include production-critical paths:

| Untested Handler | Risk |
|------------------|------|
| `login-member.handler.ts` | Authentication — HIGH |
| `get-feed.handler.ts` | Core user feature — HIGH |
| `get-comments.handler.ts` | Core user feature — HIGH |
| `verify-2fa.handler.ts` | Security — HIGH |
| `setup-2fa.handler.ts` | Security — HIGH |
| `approve-follow.handler.ts` | Social graph state machine — MEDIUM |
| `join-group.handler.ts` | Group membership logic — MEDIUM |

The `login-member.handler.ts` in particular has branches for `LOCKED`, `SUSPENDED`, and `DEACTIVATED` status that are not tested anywhere in the suite.

---

### 7.3 Frontend has zero test coverage

`apps/web/src/` contains ~70 TypeScript/TSX files. There is no test file anywhere in the frontend tree. The `vitest.config.ts` root config includes `apps/**/*.spec.ts` in its glob, but the `apps/web/vite.config.ts` does not reference Vitest at all, and there is no `apps/web/vitest.config.ts`. The frontend coverage provider is `istanbul` (in the web-level config) but there are no actual test files to execute.

This means zero test coverage for:
- All TanStack Query hooks (`useFeed`, `useFollow`, `useNotifications`, etc.)
- All Zustand store reducers (`auth.store`, `notification.store`, `ui.store`)
- The Socket.IO provider and event invalidation logic
- All React components

---

### 7.4 Cross-context event handlers partially stubbed

`apps/api/src/consumers/notification-trigger.consumer.ts` has placeholder implementations for `onPublicationCreated`, `onDiscussionCreated`, and `onReactionAdded` that only log and do not persist alerts. The tests in `notification-trigger.consumer.spec.ts` presumably test these — but the actual alert creation is never exercised for the publication/comment/reaction event types. If a future developer fills in these stubs, there are no tests to verify correctness.

---

## 8. Summary and Priority Recommendations

### Immediate Action (P0 — blocks production quality confidence)

1. **Add real bcrypt mock to integration tests** to prevent test suite slowdown as the suite grows.
2. **Add NestJS module teardown** (`afterEach(() => module.close())`) in content integration tests.
3. **Add login handler unit tests** covering the `LOCKED`, `SUSPENDED`, and `DEACTIVATED` branches.
4. **Add `DataErasureService` tests** — GDPR compliance path is critical and has zero test coverage.

### High Priority (P1 — significant coverage gaps)

5. **Add integration tests for the Admin context** — 2FA, suspension, and audit immutability.
6. **Add tests for at least the top 5 query handlers** (`get-feed`, `get-comments`, `get-post`, `get-followers`, `get-following`).
7. **Add one frontend test file** for `useFeed` and `useAuthStore` as a foundation.
8. **Add content visibility/access-control tests** for `CONNECTIONS_ONLY` and `PRIVATE` post visibility.

### Medium Priority (P2 — quality improvements)

9. **Replace `commandBus.execute: vi.fn()` pattern** with typed mock builders that verify command shape.
10. **Verify Vitest module isolation** for `bcrypt` mock across worker processes.
11. **Add `maxPages` option** to `useInfiniteQuery` calls in the frontend to bound memory.
12. **Add reaction deduplication test** and test for reacting to a deleted post.
