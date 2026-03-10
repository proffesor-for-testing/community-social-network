# Community Social Network -- GOAP Implementation Plan

**Status**: In Progress
**Date**: 2026-03-10 (updated)
**Branch**: `ddd-approach`
**Approach**: SPARC-Enhanced Goal-Oriented Action Planning
**Last Progress Update**: 2026-03-10

### Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 0: Project Scaffolding | PARTIALLY COMPLETE | ~85% (files created, `npm install` not run) |
| Phase 1: Shared Infrastructure | MOSTLY COMPLETE | ~75% (code done, tests not written) |
| Phase 2: Domain Layer | NOT STARTED | 0% |
| Phase 3: Infrastructure Layer | NOT STARTED | 0% |
| Phase 4: Application Layer | NOT STARTED | 0% |
| Phase 5: Frontend Foundation | NOT STARTED | 0% |
| Phase 6: Frontend Features | NOT STARTED | 0% |
| Phase 7: Cross-Cutting Concerns | NOT STARTED | 0% |
| Phase 8: Integration Testing & E2E | NOT STARTED | 0% |
| Phase 9: Docker & CI/CD | NOT STARTED | 0% |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State vs Goal State](#current-state-vs-goal-state)
3. [Phase Overview & Dependency Graph](#phase-overview--dependency-graph)
4. [Phase 0: Project Scaffolding](#phase-0-project-scaffolding)
5. [Phase 1: Shared Infrastructure](#phase-1-shared-infrastructure)
6. [Phase 2: Domain Layer](#phase-2-domain-layer)
7. [Phase 3: Infrastructure Layer](#phase-3-infrastructure-layer)
8. [Phase 4: Application Layer](#phase-4-application-layer)
9. [Phase 5: Frontend Foundation](#phase-5-frontend-foundation)
10. [Phase 6: Frontend Features](#phase-6-frontend-features)
11. [Phase 7: Cross-Cutting Concerns](#phase-7-cross-cutting-concerns)
12. [Phase 8: Integration Testing & E2E](#phase-8-integration-testing--e2e)
13. [Phase 9: Docker & CI/CD](#phase-9-docker--cicd)
14. [Risk Register](#risk-register)
15. [Appendix: File Ownership Matrix](#appendix-file-ownership-matrix)

---

## Executive Summary

This plan converts 16 completed Architecture Decision Records (ADRs) into a working Community Social Network application. The system is a NestJS modular monolith with a React 18 frontend, organized as an NX monorepo with 7 DDD bounded contexts.

**Key numbers:**
- 10 phases, ~45 parallel work streams
- Maximum 8-10 concurrent agents per phase
- Estimated ~180 files to create across all phases
- Each phase produces a testable, verifiable checkpoint

**Parallelization strategy:** Within each phase, tasks are grouped by bounded context or architectural layer so that agents never modify the same files. Cross-context dependencies are resolved by completing shared infrastructure first (Phases 0-1) before context-specific work (Phases 2-4).

---

## Current State vs Goal State

```
CURRENT STATE (as of 2026-03-10)       GOAL STATE
------------------------------------------------------------------
16 ADRs completed                      Full working application
NX monorepo scaffold created           NX monorepo (apps/api, apps/web)     ✅ DONE
package.json with 80 deps defined      NestJS + React + all deps            ✅ DONE (npm install pending)
DDD shared kernel (401 LOC)            >80% domain test coverage            🟡 PARTIAL
Auth infra (JWT, blacklist, rotation)  Working auth system                  🟡 PARTIAL (infra only)
Cache infra (3-tier, stampede)         Performance-optimized caching        🟡 PARTIAL (infra only)
Messaging infra (WS, DLQ, idempotent) Event-driven architecture            🟡 PARTIAL (infra only)
No domain aggregates/entities          14 aggregates across 7 contexts      ❌ NOT STARTED
No API controllers/services            71 API endpoints                     ❌ NOT STARTED
No database migrations                 Full schema with indexes             ❌ NOT STARTED
No tests                               >80% domain test coverage            ❌ NOT STARTED
No Docker                              Docker Compose + K8s manifests       ❌ NOT STARTED
No CI/CD                               GitHub Actions pipeline              ❌ NOT STARTED
No frontend components                 React feature modules                ❌ NOT STARTED
Branch: ddd-approach                   Merged to main via PR                ❌ NOT STARTED
```

### Blocking Issue

`npm install` has NOT been run. `node_modules/` does not exist. All build verification is blocked until dependencies are installed.

---

## Phase Overview & Dependency Graph

```
Phase 0: Scaffolding ─────────────────────────────────────────────────────┐
    |                                                                      |
Phase 1: Shared Infrastructure ────────────────────────────────────────┐  |
    |                                                                   |  |
Phase 2: Domain Layer (ALL 7 contexts in PARALLEL) ─────────────────┐  |  |
    |                                                                |  |  |
Phase 3: Infrastructure Layer (ALL 7 contexts in PARALLEL) ──────┐  |  |  |
    |                                                             |  |  |  |
Phase 4: Application Layer (ALL 7 contexts in PARALLEL) ──────┐  |  |  |  |
    |                              |                           |  |  |  |  |
Phase 5: Frontend Foundation       |                           |  |  |  |  |
    |                              |                           |  |  |  |  |
Phase 6: Frontend Features ────────┘                           |  |  |  |  |
    |                                                          |  |  |  |  |
Phase 7: Cross-Cutting Concerns ──────────────────────────────┘  |  |  |  |
    |                                                             |  |  |  |
Phase 8: Integration Testing & E2E ──────────────────────────────┘  |  |  |
    |                                                                |  |  |
Phase 9: Docker & CI/CD ────────────────────────────────────────────┘  |  |
                                                                        |  |
                                                     ALL PHASES COMPLETE ──┘
```

**Sequential dependencies:**
- Phase 0 must complete before Phase 1
- Phase 1 must complete before Phase 2
- Phase 2 must complete before Phase 3
- Phase 3 must complete before Phase 4
- Phase 5 can start in parallel with Phase 3 (independent frontend scaffold)
- Phase 6 requires Phase 4 (backend APIs) and Phase 5 (frontend foundation)
- Phase 7 can start after Phase 4 completes
- Phase 8 requires Phase 4 + Phase 6
- Phase 9 can start after Phase 4 (backend) and can run in parallel with Phase 7

---

## Phase 0: Project Scaffolding

**Status: PARTIALLY COMPLETE (~85%)**
**Completed**: 2026-02-05 (commit `4c81f97`)
**Remaining**: Run `npm install`, verify builds

**Goal:** A buildable, empty NX monorepo with NestJS API and React web apps, zero domain logic.

**Duration estimate:** 1 agent, sequential tasks
**Agent count:** 1 (`system-architect`)

### Tasks (Sequential)

| # | Task | Agent | Files Created | Status |
|---|------|-------|---------------|--------|
| 0.1 | Initialize NX workspace | `system-architect` | `package.json`, `nx.json`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc` | DONE |
| 0.2 | Create NestJS API app | `system-architect` | `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/project.json`, `apps/api/tsconfig.app.json`, `apps/api/tsconfig.spec.json` | DONE |
| 0.3 | Create React web app | `system-architect` | `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/project.json`, `apps/web/tsconfig.app.json` | DONE |
| 0.4 | Create library scaffold | `system-architect` | `libs/shared/types/src/index.ts`, `libs/shared/utils/src/index.ts`, `libs/shared/constants/src/index.ts` + project.json for each | DONE |
| 0.5 | Configure TypeScript paths | `system-architect` | Updates to `tsconfig.base.json` | DONE |
| 0.6 | Add root scripts | `system-architect` | Updates to root `package.json` | DONE |
| 0.7 | Configure ESLint + Prettier | `system-architect` | `.eslintrc.json` (root), per-app `.eslintrc.json` | DONE |
| 0.8 | Add `.gitignore`, `.nvmrc`, `.editorconfig` | `system-architect` | `.gitignore`, `.nvmrc`, `.editorconfig` | DONE |

### Quality Gate

- [ ] `npm install` completes without errors — **BLOCKED: not yet run**
- [ ] `nx build api` produces dist output — **BLOCKED: no node_modules**
- [ ] `nx build web` produces dist output — **BLOCKED: no node_modules**
- [ ] `nx lint api` and `nx lint web` pass — **BLOCKED: no node_modules**
- [ ] `nx graph` shows correct dependency tree (web, api, libs) — **BLOCKED: no node_modules**
- [ ] All TypeScript path aliases resolve — **BLOCKED: no node_modules**

> **Next action**: Run `npm install` then verify all quality gates pass.

---

## Phase 1: Shared Infrastructure

**Status: MOSTLY COMPLETE (~75%)**
**Code completed**: 2026-02-05 (commit `4c81f97`)
**Remaining**: Unit tests (tasks 1.22-1.25), build verification

**Goal:** Database connection, Redis client, event bus, caching service, auth module, and shared DDD base classes -- all as NX libraries.

**Duration estimate:** 3-4 agents in parallel
**Agent count:** 4 (`coder` x3, `tester` x1)

### Tasks (Parallel Groups)

#### Group A: Database + Cache (Agent: `coder-1`)

| # | Task | Files Created | Status |
|---|------|---------------|--------|
| 1.1 | TypeORM configuration module | `libs/infrastructure/database/src/database.module.ts`, `database.config.ts` | DONE (27+47 LOC) |
| 1.2 | Redis client module | `libs/infrastructure/cache/src/redis.module.ts`, `redis.config.ts` | DONE (77 LOC) |
| 1.3 | Three-tier cache service (ADR-010) | `libs/infrastructure/cache/src/three-tier-cache.service.ts`, `stampede-protection.ts` | DONE (294+155 LOC) |

> Note: `typeorm.config.ts` was not created as a separate file; config lives in `database.config.ts`. `cache.interface.ts` not created (interface inlined).

#### Group B: Event Bus + Messaging (Agent: `coder-2`)

| # | Task | Files Created | Status |
|---|------|---------------|--------|
| 1.4 | In-process event dispatcher | `libs/infrastructure/messaging/src/in-process-event-dispatcher.ts`, `event-dispatcher.interface.ts` | DONE (65 LOC) |
| 1.5 | Bull Queue integration publisher (ADR-009) | `libs/infrastructure/messaging/src/bull-queue-event-publisher.ts`, `integration-event-publisher.interface.ts`, `bull.config.ts` | DONE (95+43 LOC) |
| 1.6 | Dead letter queue handler (ADR-009) | `libs/infrastructure/messaging/src/dead-letter-queue.ts` | DONE (154 LOC) |
| 1.7 | Idempotency store | `libs/infrastructure/messaging/src/idempotency-store.ts` | DONE (115 LOC) |
| 1.8 | Socket.IO gateway scaffold | `libs/infrastructure/messaging/src/socket-io-event-emitter.ts`, `socket-io.gateway.ts` | DONE (65+141 LOC) |

#### Group C: DDD Shared Kernel (Agent: `coder-3`)

| # | Task | Files Created | Status |
|---|------|---------------|--------|
| 1.9 | AggregateRoot base class | `libs/domain/shared/src/aggregate-root.ts` | DONE (29 LOC) |
| 1.10 | Entity base class | `libs/domain/shared/src/entity.ts` | DONE (17 LOC) |
| 1.11 | ValueObject base class | `libs/domain/shared/src/value-object.ts` | DONE (52 LOC) |
| 1.12 | DomainEvent base class (ADR-009) | `libs/domain/shared/src/domain-event.ts` | DONE (30 LOC) |
| 1.13 | Repository interface | `libs/domain/shared/src/repository.interface.ts` | DONE (7 LOC) |
| 1.14 | Shared value objects: UserId, Email, Timestamp | `libs/domain/shared/src/value-objects/user-id.ts`, `email.ts`, `timestamp.ts` | DONE (35+43+47 LOC) |
| 1.15 | Domain constants (ADR-008) | `libs/domain/shared/src/constants/domain-constants.ts` | DONE (33 LOC) |
| 1.16 | Pagination types | `libs/domain/shared/src/types/pagination.ts` | DONE (19 LOC) |
| 1.17 | Domain error base classes | `libs/domain/shared/src/domain-error.ts` | DONE (52 LOC, 6 error types) |

> Note: Errors file is `domain-error.ts` at root level, not `errors/domain-error.ts` as originally planned.

#### Group D: Auth Module (Agent: `coder-4`)

| # | Task | Files Created | Status |
|---|------|---------------|--------|
| 1.18 | JWT service (ADR-004) | `libs/infrastructure/auth/src/jwt-token.service.ts`, `jwt.config.ts` | DONE (229 LOC) |
| 1.19 | Auth guard (NestJS) | `libs/infrastructure/auth/src/jwt-auth.guard.ts`, `current-user.decorator.ts` | DONE |
| 1.20 | Token blacklist (Redis) | `libs/infrastructure/auth/src/token-blacklist.service.ts` | DONE (106 LOC) |
| 1.21 | Key rotation support (ADR-004) | `libs/infrastructure/auth/src/key-rotation.service.ts` | DONE (163 LOC) |

> Note: JWT service file is named `jwt-token.service.ts` (not `jwt.service.ts`). Guard is `jwt-auth.guard.ts` (not `auth.guard.ts`).

#### Testing (Agent: `tester-1`, after Groups A-D complete)

| # | Task | Files Created | Status |
|---|------|---------------|--------|
| 1.22 | Unit tests for cache service | `libs/infrastructure/cache/src/__tests__/three-tier-cache.service.spec.ts` | NOT STARTED |
| 1.23 | Unit tests for event dispatcher | `libs/infrastructure/messaging/src/__tests__/in-process-event-dispatcher.spec.ts` | NOT STARTED |
| 1.24 | Unit tests for shared kernel | `libs/domain/shared/src/__tests__/aggregate-root.spec.ts`, `value-object.spec.ts`, `domain-event.spec.ts` | NOT STARTED |
| 1.25 | Unit tests for shared value objects | `libs/domain/shared/src/__tests__/user-id.spec.ts`, `email.spec.ts`, `timestamp.spec.ts` | NOT STARTED |

### Quality Gate

- [x] All shared kernel classes compile with zero external dependencies — **VERIFIED: domain layer has no framework imports**
- [x] `DomainEvent`, `AggregateRoot`, `ValueObject` have no `@nestjs` or `typeorm` imports — **VERIFIED**
- [x] Cache service implements 3-tier lookup (memory -> Redis -> null) — **IMPLEMENTED: LRU + Redis + fallback**
- [x] Event dispatcher dispatches events to registered handlers — **IMPLEMENTED**
- [x] JWT service generates and validates tokens — **IMPLEMENTED: dual-token with jti**
- [ ] All unit tests pass — **BLOCKED: no tests written yet (tasks 1.22-1.25)**
- [x] Architecture fitness test: `grep -r "from '@nestjs" libs/domain/` returns 0 matches — **VERIFIED**

### Implementation Details (Actual vs Planned)

| Planned File | Actual File | Notes |
|---|---|---|
| `jwt.service.ts` | `jwt-token.service.ts` | Renamed for clarity |
| `auth.guard.ts` | `jwt-auth.guard.ts` | Renamed to be more specific |
| `errors/domain-error.ts` | `domain-error.ts` | Flattened, not in subdirectory |
| `typeorm.config.ts` | _(merged into database.config.ts)_ | Combined for simplicity |
| `cache.interface.ts` | _(not created)_ | Interface inlined in service |
| `messaging.module.ts` | `messaging.module.ts` | DONE (93 LOC) |
| `auth.module.ts` | `auth.module.ts` | DONE (global module) |

---

## Phase 2: Domain Layer

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 0 completion (`npm install` + build verification), Phase 1 tests

**Goal:** Pure domain entities, value objects, aggregates, domain events, and repository interfaces for all 7 bounded contexts. ZERO framework dependencies.

**Duration estimate:** 7 agents in parallel (1 per context)
**Agent count:** 7 (`coder` x7)

### CRITICAL CONSTRAINT

Every file in `libs/domain/[context]/` MUST have:
- No imports from `@nestjs/*`, `typeorm`, `bull`, `socket.io`, `express`
- No imports from `libs/infrastructure/*`
- No imports from `libs/domain/[other-context]/*` (except `shared`)

### Parallel Work Streams

Each agent works exclusively within one bounded context directory. No file conflicts possible.

---

#### Context 1: Identity (Agent: `coder-identity`)

**Directory:** `libs/domain/identity/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.1 | Value Objects | `value-objects/member-id.ts`, `value-objects/credential.ts`, `value-objects/plain-password.ts`, `value-objects/member-status.ts`, `value-objects/session-id.ts` |
| 2.2 | Domain Events (ADR-009) | `events/member-registered.event.ts`, `events/member-authentication-succeeded.event.ts`, `events/member-locked.event.ts`, `events/member-suspended.event.ts` |
| 2.3 | Member Aggregate (ADR-008) | `aggregates/member.ts` |
| 2.4 | Session Aggregate | `aggregates/session.ts` |
| 2.5 | Repository Interfaces | `repositories/member.repository.ts`, `repositories/session.repository.ts` |
| 2.6 | Domain Errors | `errors/member-not-active.error.ts`, `errors/member-locked.error.ts`, `errors/already-suspended.error.ts`, `errors/invalid-credentials.error.ts` |
| 2.7 | Unit Tests | `__tests__/member.aggregate.spec.ts`, `__tests__/credential.spec.ts`, `__tests__/member-status.spec.ts` |
| 2.8 | Index barrel | `index.ts` |

---

#### Context 2: Profile (Agent: `coder-profile`)

**Directory:** `libs/domain/profile/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.9 | Value Objects | `value-objects/profile-id.ts`, `value-objects/display-name.ts`, `value-objects/bio.ts`, `value-objects/avatar-id.ts`, `value-objects/location.ts`, `value-objects/privacy-settings.ts`, `value-objects/media-id.ts`, `value-objects/media-status.ts`, `value-objects/media-variant.ts`, `value-objects/media-metadata.ts` |
| 2.10 | Domain Events | `events/profile-created.event.ts`, `events/profile-updated.event.ts`, `events/avatar-changed.event.ts`, `events/media-uploaded.event.ts` |
| 2.11 | Profile Aggregate (ADR-008) | `aggregates/profile.ts` |
| 2.12 | MediaAsset Aggregate | `aggregates/media-asset.ts` |
| 2.13 | Repository Interfaces | `repositories/profile.repository.ts`, `repositories/media-asset.repository.ts` |
| 2.14 | Domain Errors | `errors/profanity-not-allowed.error.ts`, `errors/invalid-file-type.error.ts`, `errors/file-too-large.error.ts`, `errors/quota-exceeded.error.ts` |
| 2.15 | Unit Tests | `__tests__/profile.aggregate.spec.ts`, `__tests__/media-asset.aggregate.spec.ts`, `__tests__/display-name.spec.ts` |
| 2.16 | Index barrel | `index.ts` |

---

#### Context 3: Content (Agent: `coder-content`)

**Directory:** `libs/domain/content/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.17 | Value Objects | `value-objects/publication-id.ts`, `value-objects/publication-content.ts`, `value-objects/visibility.ts`, `value-objects/publication-status.ts`, `value-objects/reaction-type.ts`, `value-objects/reaction-counts.ts`, `value-objects/discussion-id.ts`, `value-objects/discussion-content.ts`, `value-objects/discussion-status.ts`, `value-objects/materialized-path.ts`, `value-objects/mention.ts`, `value-objects/reaction-id.ts` |
| 2.18 | Domain Events | `events/publication-created.event.ts`, `events/publication-edited.event.ts`, `events/publication-deleted.event.ts`, `events/discussion-created.event.ts`, `events/member-mentioned.event.ts`, `events/reaction-added.event.ts`, `events/reaction-removed.event.ts`, `events/reaction-changed.event.ts` |
| 2.19 | Publication Aggregate (ADR-008) | `aggregates/publication.ts` |
| 2.20 | Discussion Aggregate | `aggregates/discussion.ts` |
| 2.21 | Reaction Aggregate | `aggregates/reaction.ts` |
| 2.22 | Repository Interfaces | `repositories/publication.repository.ts`, `repositories/discussion.repository.ts`, `repositories/reaction.repository.ts` |
| 2.23 | Domain Errors | `errors/empty-content.error.ts`, `errors/content-too-long.error.ts`, `errors/max-depth-exceeded.error.ts`, `errors/cannot-edit.error.ts` |
| 2.24 | Unit Tests | `__tests__/publication.aggregate.spec.ts`, `__tests__/discussion.aggregate.spec.ts`, `__tests__/reaction.aggregate.spec.ts`, `__tests__/materialized-path.spec.ts` |
| 2.25 | Index barrel | `index.ts` |

---

#### Context 4: Social Graph (Agent: `coder-social`)

**Directory:** `libs/domain/social-graph/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.26 | Value Objects | `value-objects/connection-id.ts`, `value-objects/connection-status.ts`, `value-objects/block-id.ts` |
| 2.27 | Domain Events | `events/followed.event.ts`, `events/follow-requested.event.ts`, `events/follow-approved.event.ts`, `events/follow-rejected.event.ts`, `events/unfollowed.event.ts`, `events/member-blocked.event.ts`, `events/member-unblocked.event.ts` |
| 2.28 | Connection Aggregate (ADR-008) | `aggregates/connection.ts` |
| 2.29 | Block Aggregate | `aggregates/block.ts` |
| 2.30 | Repository Interfaces | `repositories/connection.repository.ts`, `repositories/block.repository.ts` |
| 2.31 | Domain Errors | `errors/cannot-follow-self.error.ts`, `errors/cannot-block-self.error.ts`, `errors/invalid-status-transition.error.ts` |
| 2.32 | Unit Tests | `__tests__/connection.aggregate.spec.ts`, `__tests__/block.aggregate.spec.ts` |
| 2.33 | Index barrel | `index.ts` |

---

#### Context 5: Community (Agent: `coder-community`)

**Directory:** `libs/domain/community/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.34 | Value Objects | `value-objects/group-id.ts`, `value-objects/group-name.ts`, `value-objects/group-description.ts`, `value-objects/group-settings.ts`, `value-objects/group-rule.ts`, `value-objects/group-status.ts`, `value-objects/membership-id.ts`, `value-objects/membership-role.ts`, `value-objects/permission.ts`, `value-objects/invitation-id.ts` |
| 2.35 | Domain Events | `events/group-created.event.ts`, `events/member-joined-group.event.ts`, `events/member-left-group.event.ts`, `events/member-promoted.event.ts`, `events/member-demoted.event.ts`, `events/member-kicked.event.ts`, `events/group-settings-updated.event.ts`, `events/ownership-transferred.event.ts` |
| 2.36 | Group Aggregate (ADR-008) | `aggregates/group.ts` |
| 2.37 | Membership Aggregate | `aggregates/membership.ts` |
| 2.38 | Repository Interfaces | `repositories/group.repository.ts`, `repositories/membership.repository.ts` |
| 2.39 | Domain Errors | `errors/only-owner-can-transfer.error.ts`, `errors/max-rules-exceeded.error.ts`, `errors/cannot-promote-to-owner.error.ts` |
| 2.40 | Unit Tests | `__tests__/group.aggregate.spec.ts`, `__tests__/membership.aggregate.spec.ts` |
| 2.41 | Index barrel | `index.ts` |

---

#### Context 6: Notification (Agent: `coder-notification`)

**Directory:** `libs/domain/notification/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.42 | Value Objects | `value-objects/alert-id.ts`, `value-objects/alert-type.ts`, `value-objects/alert-content.ts`, `value-objects/alert-status.ts`, `value-objects/delivery.ts`, `value-objects/delivery-channel.ts`, `value-objects/preference-id.ts`, `value-objects/entity-id.ts` |
| 2.43 | Domain Events | `events/alert-created.event.ts`, `events/alert-delivered.event.ts`, `events/alert-read.event.ts`, `events/preferences-updated.event.ts` |
| 2.44 | Alert Aggregate (ADR-008) | `aggregates/alert.ts` |
| 2.45 | Preference Aggregate | `aggregates/preference.ts` |
| 2.46 | Repository Interfaces | `repositories/alert.repository.ts`, `repositories/preference.repository.ts` |
| 2.47 | Unit Tests | `__tests__/alert.aggregate.spec.ts`, `__tests__/preference.aggregate.spec.ts` |
| 2.48 | Index barrel | `index.ts` |

---

#### Context 7: Admin (Agent: `coder-admin`)

**Directory:** `libs/domain/admin/src/`

| # | Task | Files Created |
|---|------|---------------|
| 2.49 | Value Objects | `value-objects/admin-id.ts`, `value-objects/admin-role.ts`, `value-objects/admin-status.ts`, `value-objects/two-factor-auth.ts`, `value-objects/totp-code.ts`, `value-objects/two-factor-secret.ts`, `value-objects/ip-address.ts`, `value-objects/audit-entry-id.ts` |
| 2.50 | Domain Events | `events/audit-entry-created.event.ts`, `events/admin-2fa-enabled.event.ts`, `events/admin-2fa-disabled.event.ts`, `events/security-alert-raised.event.ts`, `events/ip-whitelisted.event.ts`, `events/ip-removed.event.ts` |
| 2.51 | Administrator Aggregate (ADR-008) | `aggregates/administrator.ts` |
| 2.52 | AuditEntry Aggregate | `aggregates/audit-entry.ts` |
| 2.53 | Repository Interfaces | `repositories/administrator.repository.ts`, `repositories/audit-entry.repository.ts` |
| 2.54 | Domain Errors | `errors/two-factor-not-enabled.error.ts`, `errors/ip-already-whitelisted.error.ts` |
| 2.55 | Unit Tests | `__tests__/administrator.aggregate.spec.ts`, `__tests__/audit-entry.aggregate.spec.ts` |
| 2.56 | Index barrel | `index.ts` |

---

### Architecture Fitness Tests (Run after all 7 contexts complete)

| # | Task | Agent | Files Created |
|---|------|-------|---------------|
| 2.57 | Domain purity checker | `tester` | `tools/architecture-tests/domain-purity.test.ts` |
| 2.58 | Cross-context import detector | `tester` | `tools/architecture-tests/context-boundaries.test.ts` |
| 2.59 | Layer dependency enforcer | `tester` | `tools/architecture-tests/layer-dependencies.test.ts` |
| 2.60 | Shared kernel scope guard | `tester` | `tools/architecture-tests/shared-kernel.test.ts` |

### Quality Gate

- [ ] All 7 context domain libraries compile
- [ ] Zero `@nestjs`, `typeorm`, `bull`, `socket.io` imports in `libs/domain/`
- [ ] Zero cross-context domain imports (except `shared`)
- [ ] All domain unit tests pass (aggregates enforce invariants)
- [ ] Architecture fitness tests pass
- [ ] Each aggregate has factory methods, not public constructors
- [ ] Each aggregate collects domain events via `addDomainEvent()`
- [ ] All value objects are immutable (`Object.freeze`)

---

## Phase 3: Infrastructure Layer

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 2 (Domain Layer)

**Goal:** TypeORM entities, repository implementations, aggregate mappers, Bull Queue consumers, and NestJS modules for all 7 bounded contexts.

**Duration estimate:** 7 agents in parallel + 1 tester
**Agent count:** 8 (`coder` x7, `tester` x1)

### Parallel Work Streams

Each agent works within `libs/infrastructure/[context]/src/`. No file conflicts.

---

#### Per-Context Tasks (Repeated for each of 7 contexts)

For each context, the agent creates:

| # | Task | Files Created (template: `libs/infrastructure/[context]/src/`) |
|---|------|---------------------------------------------------------------|
| 3.X.1 | TypeORM entities | `entities/[aggregate].entity.ts` (1 per aggregate) |
| 3.X.2 | Aggregate mappers (ADR-010) | `mappers/[aggregate].mapper.ts` (1 per aggregate) |
| 3.X.3 | Repository implementations | `repositories/postgres-[aggregate].repository.ts` (1 per aggregate root) |
| 3.X.4 | In-memory repository (testing) | `repositories/in-memory-[aggregate].repository.ts` (1 per aggregate root) |
| 3.X.5 | NestJS module | `[context].infrastructure.module.ts` |
| 3.X.6 | Database migration | `migrations/[timestamp]-create-[context]-tables.ts` |
| 3.X.7 | Unit tests | `__tests__/[aggregate].mapper.spec.ts`, `__tests__/in-memory-[aggregate].repository.spec.ts` |

#### Context-Specific Details

**Identity (Agent: `coder-infra-identity`)**
- Entities: `MemberEntity`, `SessionEntity`, `RefreshTokenEntity`
- Extra: Bcrypt password hashing in mapper
- Migration tables: `users`, `refresh_tokens`

**Profile (Agent: `coder-infra-profile`)**
- Entities: `ProfileEntity`, `MediaAssetEntity`, `QuotaEntity`
- Extra: S3 upload adapter stub
- Migration tables: `user_profiles`, `media`, `user_quotas`

**Content (Agent: `coder-infra-content`)**
- Entities: `PostEntity`, `CommentEntity`, `ReactionEntity`, `PostMediaEntity`
- Extra: Feed cache service (Redis sorted set)
- Migration tables: `posts`, `comments`, `comment_mentions`, `comment_reactions`, `post_media`

**Social Graph (Agent: `coder-infra-social`)**
- Entities: `FollowEntity`, `BlockEntity`, `FollowSuggestionEntity`
- Extra: Follower/following count triggers
- Migration tables: `follows`, `blocks`, `follow_suggestions`

**Community (Agent: `coder-infra-community`)**
- Entities: `GroupEntity`, `GroupMemberEntity`, `MembershipRequestEntity`, `GroupInvitationEntity`, `ModerationLogEntity`
- Extra: Permission cache (Redis hash)
- Migration tables: `groups`, `group_members`, `membership_requests`, `group_invitations`, `moderation_logs`

**Notification (Agent: `coder-infra-notification`)**
- Entities: `NotificationEntity`, `NotificationPreferenceEntity`
- Extra: Notification partitioning strategy
- Migration tables: `notifications` (partitioned), `notification_preferences`

**Admin (Agent: `coder-infra-admin`)**
- Entities: `AdminUserEntity`, `AdminTwoFactorEntity`, `AdminSessionEntity`, `AdminIPWhitelistEntity`, `AuditLogEntity`, `SecurityAlertEntity`
- Extra: Audit log immutability enforcement
- Migration tables: `admin_users`, `admin_two_factor`, `admin_sessions`, `admin_ip_whitelist`, `audit_logs`, `security_alerts`

---

#### Cross-Context Infrastructure (Agent: `coder-infra-shared`)

| # | Task | Files Created |
|---|------|---------------|
| 3.57 | Base repository implementation (ADR-010) | `libs/infrastructure/shared/src/repositories/base.repository.ts` |
| 3.58 | Aggregate mapper interface | `libs/infrastructure/shared/src/mappers/aggregate-mapper.interface.ts` |
| 3.59 | Optimistic lock error class | `libs/infrastructure/shared/src/errors/optimistic-lock.error.ts` |
| 3.60 | Unit of Work implementation | `libs/infrastructure/shared/src/persistence/typeorm-unit-of-work.ts` |
| 3.61 | Bull Queue consumer base | `libs/infrastructure/shared/src/messaging/base-queue-consumer.ts` |
| 3.62 | Integration event consumer registry | `libs/infrastructure/shared/src/messaging/event-consumer-registry.ts` |

### Quality Gate

- [ ] All TypeORM entities have proper column decorators
- [ ] All mappers correctly round-trip (toDomain -> toPersistence -> toDomain)
- [ ] All in-memory repositories pass the same tests as Postgres repositories
- [ ] Migrations run successfully against a clean PostgreSQL database
- [ ] Repository implementations use 3-tier caching
- [ ] Optimistic locking test: concurrent saves produce `OptimisticLockError`
- [ ] NestJS modules export repository tokens for DI

---

## Phase 4: Application Layer

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 3 (Infrastructure Layer)

**Goal:** Use cases (commands + queries), DTOs, REST controllers, and event handlers for all 7 bounded contexts. Working API endpoints.

**Duration estimate:** 7 agents in parallel + 1 reviewer
**Agent count:** 8 (`coder` x7, `reviewer` x1)

### Parallel Work Streams

Each agent works within `apps/api/src/modules/[context]/`. No file conflicts.

---

#### Per-Context Tasks (Repeated for each of 7 contexts)

| # | Task | Files Created (template: `apps/api/src/modules/[context]/`) |
|---|------|-------------------------------------------------------------|
| 4.X.1 | DTOs (request + response) | `dto/[action].dto.ts` |
| 4.X.2 | Command handlers | `commands/[action].command.ts`, `commands/[action].handler.ts` |
| 4.X.3 | Query handlers | `queries/[query].query.ts`, `queries/[query].handler.ts` |
| 4.X.4 | REST controllers | `controllers/[resource].controller.ts` |
| 4.X.5 | Event handlers (in-process) | `event-handlers/[event].handler.ts` |
| 4.X.6 | Integration event consumers | `consumers/[event].consumer.ts` |
| 4.X.7 | NestJS module | `[context].module.ts` |
| 4.X.8 | Controller tests | `__tests__/[resource].controller.spec.ts` |
| 4.X.9 | Command handler tests | `__tests__/[action].handler.spec.ts` |

#### Context-Specific Endpoints

**Identity (Agent: `coder-app-identity`)**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
```

**Profile (Agent: `coder-app-profile`)**
```
GET    /api/profiles/:id
PUT    /api/profiles/:id
POST   /api/profiles/:id/avatar
GET    /api/profiles/:id/media
DELETE /api/profiles/:id/media/:mediaId
```

**Content (Agent: `coder-app-content`)**
```
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
GET    /api/feed
POST   /api/posts/:id/comments
GET    /api/posts/:id/comments
POST   /api/posts/:id/reactions
DELETE /api/posts/:id/reactions
POST   /api/comments/:id/reactions
```

**Social Graph (Agent: `coder-app-social`)**
```
POST   /api/connections/follow/:userId
DELETE /api/connections/follow/:userId
POST   /api/connections/approve/:connectionId
POST   /api/connections/reject/:connectionId
GET    /api/connections/followers
GET    /api/connections/following
GET    /api/connections/pending
POST   /api/blocks/:userId
DELETE /api/blocks/:userId
GET    /api/blocks
```

**Community (Agent: `coder-app-community`)**
```
POST   /api/groups
GET    /api/groups/:id
PUT    /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/:id/join
POST   /api/groups/:id/leave
GET    /api/groups/:id/members
PUT    /api/groups/:id/members/:memberId/role
DELETE /api/groups/:id/members/:memberId
GET    /api/groups/search
```

**Notification (Agent: `coder-app-notification`)**
```
GET    /api/notifications
GET    /api/notifications/unread-count
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all
GET    /api/notifications/preferences
PUT    /api/notifications/preferences
```

**Admin (Agent: `coder-app-admin`)**
```
POST   /api/admin/auth/login
POST   /api/admin/auth/verify-2fa
GET    /api/admin/users
PUT    /api/admin/users/:id/suspend
PUT    /api/admin/users/:id/unsuspend
GET    /api/admin/audit-log
GET    /api/admin/security-alerts
POST   /api/admin/2fa/setup
POST   /api/admin/2fa/verify
```

---

#### Cross-Context Event Wiring (Agent: `coder-app-events`)

| # | Task | Files Created |
|---|------|---------------|
| 4.57 | Event handler registry (ADR-009) | `apps/api/src/bootstrap/event-handler-registry.ts` |
| 4.58 | Integration event routing | `apps/api/src/bootstrap/integration-event-routing.ts` |
| 4.59 | Cross-context event flows | `apps/api/src/consumers/block-content-filter.consumer.ts`, `apps/api/src/consumers/notification-trigger.consumer.ts`, `apps/api/src/consumers/audit-logger.consumer.ts` |
| 4.60 | App module (root NestJS wiring) | `apps/api/src/app.module.ts` (update) |

### Quality Gate

- [ ] All REST endpoints return correct HTTP status codes
- [ ] JWT auth guard protects all endpoints except register/login
- [ ] Request validation rejects malformed input (class-validator)
- [ ] Command handlers use repository interfaces (not implementations)
- [ ] Domain events are published after successful aggregate operations
- [ ] Integration events are routed to Bull Queue
- [ ] Cross-context event consumers are registered and functional
- [ ] All controller and handler tests pass with in-memory repositories
- [ ] API responds to health check at `/health/live` and `/health/ready`

---

## Phase 5: Frontend Foundation

**Status: NOT STARTED (0%)**
**Can start in parallel with**: Phase 3

**Goal:** React app with routing, auth flow, API client, Socket.IO integration, and shared component library. No feature-specific pages yet.

**Duration estimate:** 3 agents in parallel
**Agent count:** 3 (`coder` x3)

**Can start in parallel with Phase 3** (no backend dependency for scaffold)

### Parallel Work Streams

#### Group A: Core Setup (Agent: `coder-fe-core`)

| # | Task | Files Created (prefix: `apps/web/src/`) |
|---|------|----------------------------------------|
| 5.1 | Vite configuration | `vite.config.ts` (update), `vite-env.d.ts` |
| 5.2 | Tailwind CSS setup | `tailwind.config.ts`, `postcss.config.js`, `styles/globals.css` |
| 5.3 | React Router setup | `App.tsx` (update), `router.tsx` |
| 5.4 | TanStack Query provider | `shared/query-config.ts`, provider in `App.tsx` |
| 5.5 | API client (Axios) | `api/client.ts`, `api/error-handler.ts` |
| 5.6 | API types (from OpenAPI or manual) | `api/types.ts` |
| 5.7 | Error boundary | `shared/error-boundary.tsx` |
| 5.8 | Layouts | `shared/layouts/app-layout.tsx`, `shared/layouts/auth-layout.tsx`, `shared/layouts/admin-layout.tsx` |

#### Group B: Auth + State (Agent: `coder-fe-auth`)

| # | Task | Files Created (prefix: `apps/web/src/`) |
|---|------|----------------------------------------|
| 5.9 | Auth store (Zustand) | `stores/auth.store.ts` |
| 5.10 | UI store | `stores/ui.store.ts` |
| 5.11 | Toast store | `stores/toast.store.ts` |
| 5.12 | Notification store | `stores/notification.store.ts` |
| 5.13 | Auth hooks | `features/auth/hooks/useLogin.ts`, `useRegister.ts`, `useLogout.ts`, `useCurrentUser.ts` |
| 5.14 | Auth pages | `features/auth/components/LoginForm.tsx`, `RegisterForm.tsx` |
| 5.15 | Auth routes | `features/auth/routes.tsx` |
| 5.16 | Protected route component | `shared/components/organisms/ProtectedRoute.tsx` |

#### Group C: Shared Components + Socket (Agent: `coder-fe-components`)

| # | Task | Files Created (prefix: `apps/web/src/`) |
|---|------|----------------------------------------|
| 5.17 | Atoms | `shared/components/atoms/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Avatar.tsx`, `Spinner.tsx`, `Icon.tsx` |
| 5.18 | Molecules | `shared/components/molecules/FormField.tsx`, `SearchBar.tsx`, `DropdownMenu.tsx`, `Toast.tsx` |
| 5.19 | Organisms | `shared/components/organisms/Header.tsx`, `Sidebar.tsx`, `Modal.tsx`, `DataTable.tsx` |
| 5.20 | Socket.IO provider | `socket/socket-provider.tsx` |
| 5.21 | Socket event hooks | `socket/use-socket-events.ts` |
| 5.22 | Event-to-query invalidation | `socket/event-invalidation.ts` |
| 5.23 | Component tests | `shared/components/__tests__/Button.test.tsx`, `Input.test.tsx`, `Modal.test.tsx` |

### Quality Gate

- [ ] `nx build web` produces working bundle
- [ ] Login/Register forms render and submit
- [ ] Auth tokens stored in memory (access) and HttpOnly cookie (refresh) per ADR-004
- [ ] Protected routes redirect to /login when unauthenticated
- [ ] Socket.IO connects and subscribes to user room
- [ ] Shared components render correctly
- [ ] Component tests pass
- [ ] Tailwind utilities apply correctly

---

## Phase 6: Frontend Features

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 4 + Phase 5

**Goal:** Feature pages for all 7 bounded contexts, connected to the backend API.

**Duration estimate:** 7 agents in parallel
**Agent count:** 7 (`coder` x7)

**Requires:** Phase 4 (backend APIs) + Phase 5 (frontend foundation)

### Parallel Work Streams

Each agent works within `apps/web/src/features/[feature]/`. No file conflicts.

---

#### Feature 1: Profile (Agent: `coder-fe-profile`)

| # | Task | Files Created (prefix: `apps/web/src/features/profile/`) |
|---|------|----------------------------------------------------------|
| 6.1 | Query factories | `queries.ts` |
| 6.2 | Hooks | `hooks/useProfile.ts`, `hooks/useUpdateProfile.ts`, `hooks/useAvatarUpload.ts` |
| 6.3 | Components | `components/ProfileCard.tsx`, `components/ProfileSettings.tsx`, `components/AvatarUpload.tsx`, `components/ProfileHeader.tsx` |
| 6.4 | Routes | `routes.tsx` |
| 6.5 | Tests | `__tests__/ProfileCard.test.tsx`, `__tests__/useProfile.test.ts` |

---

#### Feature 2: Feed / Posts (Agent: `coder-fe-feed`)

| # | Task | Files Created (prefix: `apps/web/src/features/feed/`) |
|---|------|-------------------------------------------------------|
| 6.6 | Query factories | `queries.ts` |
| 6.7 | Hooks | `hooks/useFeed.ts`, `hooks/useCreatePost.ts`, `hooks/useReaction.ts`, `hooks/useDeletePost.ts` |
| 6.8 | Components | `components/FeedList.tsx`, `components/PostCard.tsx`, `components/CreatePostForm.tsx`, `components/ReactionBar.tsx`, `components/PostDetail.tsx` |
| 6.9 | Infinite scroll | Integration with `useIntersectionObserver` in FeedList |
| 6.10 | Routes | `routes.tsx` |
| 6.11 | Tests | `__tests__/PostCard.test.tsx`, `__tests__/useFeed.test.ts` |

---

#### Feature 3: Comments (Agent: `coder-fe-comments`)

| # | Task | Files Created (prefix: `apps/web/src/features/comments/`) |
|---|------|-----------------------------------------------------------|
| 6.12 | Query factories | `queries.ts` |
| 6.13 | Hooks | `hooks/useComments.ts`, `hooks/useCreateComment.ts`, `hooks/useCommentReaction.ts` |
| 6.14 | Components | `components/CommentThread.tsx`, `components/CommentForm.tsx`, `components/CommentItem.tsx` |
| 6.15 | Routes | `routes.tsx` |
| 6.16 | Tests | `__tests__/CommentThread.test.tsx` |

---

#### Feature 4: Social (Agent: `coder-fe-social`)

| # | Task | Files Created (prefix: `apps/web/src/features/social/`) |
|---|------|----------------------------------------------------------|
| 6.17 | Query factories | `queries.ts` |
| 6.18 | Hooks | `hooks/useFollow.ts`, `hooks/useBlock.ts`, `hooks/useFollowers.ts`, `hooks/useFollowing.ts` |
| 6.19 | Components | `components/FollowButton.tsx`, `components/FollowersList.tsx`, `components/FollowingList.tsx`, `components/BlockedList.tsx`, `components/PendingRequests.tsx` |
| 6.20 | Routes | `routes.tsx` |
| 6.21 | Tests | `__tests__/FollowButton.test.tsx` |

---

#### Feature 5: Groups (Agent: `coder-fe-groups`)

| # | Task | Files Created (prefix: `apps/web/src/features/groups/`) |
|---|------|----------------------------------------------------------|
| 6.22 | Query factories | `queries.ts` |
| 6.23 | Hooks | `hooks/useGroup.ts`, `hooks/useJoinGroup.ts`, `hooks/useGroupMembers.ts`, `hooks/useCreateGroup.ts` |
| 6.24 | Components | `components/GroupCard.tsx`, `components/GroupDetail.tsx`, `components/GroupSettings.tsx`, `components/MemberList.tsx`, `components/CreateGroupForm.tsx` |
| 6.25 | Routes | `routes.tsx` |
| 6.26 | Tests | `__tests__/GroupCard.test.tsx` |

---

#### Feature 6: Notifications (Agent: `coder-fe-notifications`)

| # | Task | Files Created (prefix: `apps/web/src/features/notifications/`) |
|---|------|----------------------------------------------------------------|
| 6.27 | Query factories | `queries.ts` |
| 6.28 | Hooks | `hooks/useNotifications.ts`, `hooks/useMarkRead.ts`, `hooks/useUnreadCount.ts` |
| 6.29 | Components | `components/NotificationList.tsx`, `components/NotificationItem.tsx`, `components/NotificationBadge.tsx`, `components/NotificationPreferences.tsx` |
| 6.30 | Real-time integration | Socket event subscription for instant notification display |
| 6.31 | Routes | `routes.tsx` |
| 6.32 | Tests | `__tests__/NotificationList.test.tsx` |

---

#### Feature 7: Admin (Agent: `coder-fe-admin`)

| # | Task | Files Created (prefix: `apps/web/src/features/admin/`) |
|---|------|--------------------------------------------------------|
| 6.33 | Query factories | `queries.ts` |
| 6.34 | Hooks | `hooks/useAdminStats.ts`, `hooks/useAuditLog.ts`, `hooks/useUserManagement.ts` |
| 6.35 | Components | `components/Dashboard.tsx`, `components/AuditLog.tsx`, `components/UserManagement.tsx`, `components/SecurityAlerts.tsx`, `components/TwoFactorSetup.tsx` |
| 6.36 | Routes | `routes.tsx` |
| 6.37 | Tests | `__tests__/Dashboard.test.tsx` |

---

#### Router Assembly (After all features, Agent: `coder-fe-core`)

| # | Task | Files Modified |
|---|------|----------------|
| 6.38 | Assemble all feature routes into main router | `apps/web/src/router.tsx` (update) |
| 6.39 | Add lazy loading for all feature routes | `apps/web/src/router.tsx` (update) |

### Quality Gate

- [ ] All feature pages render correctly
- [ ] API calls succeed against running backend
- [ ] Lazy loading works (code-split per route)
- [ ] Socket.IO events update notification badge in real-time
- [ ] Optimistic updates work for follow/unfollow, reactions
- [ ] All component tests pass
- [ ] No cross-feature imports (features only import from `shared/`, `api/`, `stores/`, `socket/`)

---

## Phase 7: Cross-Cutting Concerns

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 4

**Goal:** Observability (logging, metrics, tracing), GDPR compliance, file storage, and email delivery.

**Duration estimate:** 4 agents in parallel
**Agent count:** 4 (`coder` x4)

**Requires:** Phase 4 (backend APIs)
**Can run in parallel with:** Phase 6 (frontend features)

### Parallel Work Streams

#### Group A: Observability (Agent: `coder-observability`, ADR-012)

| # | Task | Files Created |
|---|------|---------------|
| 7.1 | Pino logger configuration | `libs/infrastructure/observability/src/logger.config.ts`, `logger.module.ts` |
| 7.2 | Request logging middleware | `libs/infrastructure/observability/src/request-logger.middleware.ts` |
| 7.3 | Prometheus metrics | `libs/infrastructure/observability/src/metrics.service.ts`, `metrics.controller.ts` |
| 7.4 | OpenTelemetry tracing | `libs/infrastructure/observability/src/tracing.config.ts` |
| 7.5 | Health check endpoints | `apps/api/src/health/health.controller.ts`, `health.module.ts` |
| 7.6 | Correlation ID middleware | `libs/infrastructure/observability/src/correlation-id.middleware.ts` |

#### Group B: GDPR Compliance (Agent: `coder-gdpr`, ADR-013)

| # | Task | Files Created |
|---|------|---------------|
| 7.7 | Data export service | `libs/infrastructure/gdpr/src/data-export.service.ts` |
| 7.8 | Right to erasure service | `libs/infrastructure/gdpr/src/data-erasure.service.ts` |
| 7.9 | Consent management | `libs/infrastructure/gdpr/src/consent.service.ts`, `consent.entity.ts` |
| 7.10 | GDPR controller | `apps/api/src/modules/privacy/privacy.controller.ts`, `privacy.module.ts` |
| 7.11 | Privacy frontend | `apps/web/src/features/privacy/components/CookieConsentBanner.tsx`, `DataExportRequest.tsx`, `DeleteAccount.tsx` |

#### Group C: File Storage (Agent: `coder-storage`, ADR-015)

| # | Task | Files Created |
|---|------|---------------|
| 7.12 | S3 upload service | `libs/infrastructure/storage/src/s3-upload.service.ts` |
| 7.13 | Sharp image processor | `libs/infrastructure/storage/src/image-processor.service.ts` |
| 7.14 | CDN URL generator | `libs/infrastructure/storage/src/cdn-url.service.ts` |
| 7.15 | File upload controller | `apps/api/src/modules/upload/upload.controller.ts`, `upload.module.ts` |
| 7.16 | Magic bytes validator | `libs/infrastructure/storage/src/magic-bytes-validator.ts` |

#### Group D: Email Delivery (Agent: `coder-email`, ADR-016)

| # | Task | Files Created |
|---|------|---------------|
| 7.17 | Email service (Nodemailer + SES) | `libs/infrastructure/email/src/email.service.ts` |
| 7.18 | Handlebars template engine | `libs/infrastructure/email/src/template-engine.ts` |
| 7.19 | Email templates | `libs/infrastructure/email/templates/welcome.hbs`, `password-reset.hbs`, `notification-digest.hbs` |
| 7.20 | Email queue (Bull) | `libs/infrastructure/email/src/email-queue.consumer.ts` |
| 7.21 | Email module | `libs/infrastructure/email/src/email.module.ts` |

### Quality Gate

- [ ] Structured JSON logs output on every request
- [ ] Prometheus metrics endpoint at `/metrics` returns valid metrics
- [ ] Health check responds at `/health/live` and `/health/ready`
- [ ] Correlation IDs propagate through request lifecycle
- [ ] GDPR data export generates JSON with all user data
- [ ] GDPR erasure soft-deletes user data across all contexts
- [ ] File uploads succeed to S3-compatible storage
- [ ] Image variants generated (100px, 200px, 400px, 800px)
- [ ] Magic bytes validation rejects non-image files
- [ ] Email templates render correctly with Handlebars
- [ ] Email queue processes and retries on failure

---

## Phase 8: Integration Testing & E2E

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 4 + Phase 6

**Goal:** Full integration tests against real database, API E2E tests, and Playwright browser tests.

**Duration estimate:** 3 agents in parallel
**Agent count:** 3 (`tester` x3)

**Requires:** Phase 4 + Phase 6

### Parallel Work Streams

#### Group A: Backend Integration Tests (Agent: `tester-backend`)

| # | Task | Files Created |
|---|------|---------------|
| 8.1 | Test database setup | `tests/setup/test-database.ts`, `tests/setup/test-redis.ts` |
| 8.2 | Test factories | `tests/factories/member.factory.ts`, `tests/factories/publication.factory.ts`, etc. |
| 8.3 | Identity integration tests | `tests/integration/identity/register.test.ts`, `login.test.ts`, `refresh-token.test.ts`, `logout.test.ts` |
| 8.4 | Content integration tests | `tests/integration/content/create-post.test.ts`, `feed.test.ts`, `comments.test.ts`, `reactions.test.ts` |
| 8.5 | Social Graph integration tests | `tests/integration/social-graph/follow.test.ts`, `block.test.ts` |
| 8.6 | Community integration tests | `tests/integration/community/group.test.ts`, `membership.test.ts` |

#### Group B: Cross-Context Integration Tests (Agent: `tester-cross`)

| # | Task | Files Created |
|---|------|---------------|
| 8.7 | Block + Feed filtering test | `tests/integration/cross-context/block-filters-feed.test.ts` |
| 8.8 | Post + Notification test | `tests/integration/cross-context/post-creates-notification.test.ts` |
| 8.9 | Follow + Feed test | `tests/integration/cross-context/follow-populates-feed.test.ts` |
| 8.10 | Member suspension + all contexts | `tests/integration/cross-context/suspension-blocks-access.test.ts` |
| 8.11 | Event flow end-to-end | `tests/integration/cross-context/event-flow-complete.test.ts` |

#### Group C: E2E / Playwright Tests (Agent: `tester-e2e`)

| # | Task | Files Created |
|---|------|---------------|
| 8.12 | Playwright configuration | `tests/e2e/playwright.config.ts` |
| 8.13 | Auth flow E2E | `tests/e2e/auth-flow.spec.ts` |
| 8.14 | Post creation E2E | `tests/e2e/post-creation.spec.ts` |
| 8.15 | Follow/Unfollow E2E | `tests/e2e/follow-flow.spec.ts` |
| 8.16 | Group lifecycle E2E | `tests/e2e/group-lifecycle.spec.ts` |
| 8.17 | Notification flow E2E | `tests/e2e/notification-flow.spec.ts` |
| 8.18 | MSW handlers for frontend tests | `tests/mocks/handlers.ts`, `tests/mocks/server.ts` |

### Quality Gate

- [ ] All integration tests pass against real PostgreSQL + Redis
- [ ] Cross-context event flows verified end-to-end
- [ ] Optimistic locking works under concurrent writes
- [ ] 3-tier cache verified (memory -> Redis -> DB hit patterns)
- [ ] All Playwright E2E tests pass in headless Chrome
- [ ] Test coverage report generated (target: >80% domain, >60% infra, >50% controllers)
- [ ] No flaky tests (all tests pass 3 consecutive runs)

---

## Phase 9: Docker & CI/CD

**Status: NOT STARTED (0%)**
**Blocked by**: Phase 4

**Goal:** Docker Compose for development, Kubernetes manifests for production, and GitHub Actions CI/CD pipeline.

**Duration estimate:** 2 agents in parallel
**Agent count:** 2 (`coder` x1, `system-architect` x1)

**Requires:** Phase 4 (backend APIs complete)
**Can run in parallel with:** Phase 7, Phase 8

### Parallel Work Streams

#### Group A: Docker (Agent: `coder-docker`)

| # | Task | Files Created |
|---|------|---------------|
| 9.1 | API Dockerfile (multi-stage) | `apps/api/Dockerfile` |
| 9.2 | Web Dockerfile | `apps/web/Dockerfile` |
| 9.3 | Docker Compose (dev) | `docker-compose.yml` |
| 9.4 | Docker Compose (test) | `docker-compose.test.yml` |
| 9.5 | Environment files | `.env.example`, `.env.development`, `.env.test` |
| 9.6 | Database init script | `scripts/init-db.sh` |
| 9.7 | Nginx config (frontend) | `apps/web/nginx.conf` |

#### Group B: Kubernetes + CI/CD (Agent: `system-architect`)

| # | Task | Files Created |
|---|------|---------------|
| 9.8 | K8s API deployment | `k8s/api/deployment.yaml`, `service.yaml`, `hpa.yaml` |
| 9.9 | K8s Web deployment | `k8s/web/deployment.yaml`, `service.yaml` |
| 9.10 | K8s Ingress | `k8s/ingress.yaml` |
| 9.11 | K8s ConfigMap + Secrets | `k8s/configmap.yaml`, `k8s/secrets.yaml` |
| 9.12 | K8s PostgreSQL StatefulSet | `k8s/postgres/statefulset.yaml`, `service.yaml`, `pvc.yaml` |
| 9.13 | K8s Redis Deployment | `k8s/redis/deployment.yaml`, `service.yaml` |
| 9.14 | GitHub Actions: CI | `.github/workflows/ci.yml` |
| 9.15 | GitHub Actions: CD | `.github/workflows/cd.yml` |
| 9.16 | GitHub Actions: PR checks | `.github/workflows/pr-checks.yml` |
| 9.17 | Migration job | `k8s/jobs/migration.yaml` |

### Quality Gate

- [ ] `docker-compose up` starts all services (API, web, PostgreSQL, Redis)
- [ ] API is accessible at `http://localhost:3000`
- [ ] Web is accessible at `http://localhost:4200`
- [ ] Database migrations run automatically on startup
- [ ] Health checks pass in Docker environment
- [ ] CI pipeline: lint -> test -> build -> architecture tests
- [ ] CD pipeline: build image -> push to registry -> deploy to K8s
- [ ] `.env.example` documents all required environment variables
- [ ] K8s manifests pass `kubectl --dry-run=client` validation

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| NX workspace complexity | High | Medium | Start with minimal config, add libraries incrementally |
| TypeORM migration conflicts | Medium | Medium | One agent per context for migrations, sequential migration naming |
| Domain model drift between ADR and code | High | Low | Architecture fitness tests in CI |
| Cache inconsistency | Medium | Medium | Integration tests verify 3-tier cache behavior |
| Cross-context event ordering | High | Low | Idempotent handlers, event versioning (ADR-009) |
| Parallel agent file conflicts | High | Medium | Strict file ownership per agent per phase |
| Frontend/backend contract mismatch | Medium | Medium | Generated API types from OpenAPI spec |
| Socket.IO connection management at scale | Medium | Low | Redis adapter, room-based subscriptions |
| Database connection pool exhaustion | High | Low | PgBouncer, 20 connections per pod limit |
| Scope creep in domain logic | Medium | High | Stick to ADR definitions, no gold-plating |

---

## Appendix: File Ownership Matrix

This matrix ensures no two agents modify the same files within a phase.

### Phase 2: Domain Layer Ownership

| Agent | Owned Directory | Touches |
|-------|----------------|---------|
| `coder-identity` | `libs/domain/identity/` | Only files within this directory |
| `coder-profile` | `libs/domain/profile/` | Only files within this directory |
| `coder-content` | `libs/domain/content/` | Only files within this directory |
| `coder-social` | `libs/domain/social-graph/` | Only files within this directory |
| `coder-community` | `libs/domain/community/` | Only files within this directory |
| `coder-notification` | `libs/domain/notification/` | Only files within this directory |
| `coder-admin` | `libs/domain/admin/` | Only files within this directory |

### Phase 3: Infrastructure Layer Ownership

| Agent | Owned Directory | Touches |
|-------|----------------|---------|
| `coder-infra-identity` | `libs/infrastructure/identity/` | Only files within this directory |
| `coder-infra-profile` | `libs/infrastructure/profile/` | Only files within this directory |
| `coder-infra-content` | `libs/infrastructure/content/` | Only files within this directory |
| `coder-infra-social` | `libs/infrastructure/social-graph/` | Only files within this directory |
| `coder-infra-community` | `libs/infrastructure/community/` | Only files within this directory |
| `coder-infra-notification` | `libs/infrastructure/notification/` | Only files within this directory |
| `coder-infra-admin` | `libs/infrastructure/admin/` | Only files within this directory |
| `coder-infra-shared` | `libs/infrastructure/shared/` | Only files within this directory |

### Phase 4: Application Layer Ownership

| Agent | Owned Directory | Touches |
|-------|----------------|---------|
| `coder-app-identity` | `apps/api/src/modules/identity/` | Only files within this directory |
| `coder-app-profile` | `apps/api/src/modules/profile/` | Only files within this directory |
| `coder-app-content` | `apps/api/src/modules/content/` | Only files within this directory |
| `coder-app-social` | `apps/api/src/modules/social-graph/` | Only files within this directory |
| `coder-app-community` | `apps/api/src/modules/community/` | Only files within this directory |
| `coder-app-notification` | `apps/api/src/modules/notification/` | Only files within this directory |
| `coder-app-admin` | `apps/api/src/modules/admin/` | Only files within this directory |
| `coder-app-events` | `apps/api/src/bootstrap/`, `apps/api/src/consumers/` | Only files within these directories |

### Phase 6: Frontend Feature Ownership

| Agent | Owned Directory | Touches |
|-------|----------------|---------|
| `coder-fe-profile` | `apps/web/src/features/profile/` | Only files within this directory |
| `coder-fe-feed` | `apps/web/src/features/feed/` | Only files within this directory |
| `coder-fe-comments` | `apps/web/src/features/comments/` | Only files within this directory |
| `coder-fe-social` | `apps/web/src/features/social/` | Only files within this directory |
| `coder-fe-groups` | `apps/web/src/features/groups/` | Only files within this directory |
| `coder-fe-notifications` | `apps/web/src/features/notifications/` | Only files within this directory |
| `coder-fe-admin` | `apps/web/src/features/admin/` | Only files within this directory |

---

## Swarm Orchestration Cheat Sheet

### Phase 0 (1 agent, sequential)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 1 --strategy specialized
```

### Phase 1 (4 agents, parallel groups)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 4 --strategy specialized
# Agents: coder-db, coder-events, coder-kernel, coder-auth
```

### Phase 2 (8 agents: 7 context coders + 1 tester)
```bash
npx @claude-flow/cli@latest swarm init --topology mesh --max-agents 8 --strategy specialized
# Agents: coder-identity, coder-profile, coder-content, coder-social,
#          coder-community, coder-notification, coder-admin, tester-arch
```

### Phase 3 (8 agents: 7 infra + 1 shared)
```bash
npx @claude-flow/cli@latest swarm init --topology mesh --max-agents 8 --strategy specialized
```

### Phase 4 (8 agents: 7 app + 1 event wiring)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Phase 5 (3 agents, parallel)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 3 --strategy specialized
# Can start in parallel with Phase 3
```

### Phase 6 (7 agents + 1 assembler)
```bash
npx @claude-flow/cli@latest swarm init --topology mesh --max-agents 8 --strategy specialized
```

### Phase 7 (4 agents, parallel)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 4 --strategy specialized
# Can start in parallel with Phase 6
```

### Phase 8 (3 agents, parallel)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 3 --strategy specialized
```

### Phase 9 (2 agents, parallel)
```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 2 --strategy specialized
```

---

## Summary: Phase Execution Timeline

```
Timeline (sequential phases shown on same row, parallel on separate rows):

Week 1:  [Phase 0]-->[Phase 1]
Week 2:  [Phase 2: 7 domain contexts in parallel]
Week 3:  [Phase 3: 7 infra contexts in parallel] + [Phase 5: frontend foundation]
Week 4:  [Phase 4: 7 app contexts in parallel]
Week 5:  [Phase 6: 7 frontend features] + [Phase 7: cross-cutting] + [Phase 9: Docker/CI]
Week 6:  [Phase 8: integration/E2E testing]
```

**Total estimated duration:** 6 weeks with concurrent agent execution
**Maximum concurrent agents at peak:** 8-10 (Phases 2, 3, 4, 6)

---

*Document generated: 2026-02-05*
*Based on: ADR-001 through ADR-016*
*Branch: ddd-approach*
