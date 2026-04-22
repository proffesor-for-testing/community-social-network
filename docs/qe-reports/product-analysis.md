# SFDIPOT Product Analysis — Community Social Network

**Date:** 2026-04-21
**Branch:** `ddd-approach`
**Analyst:** QE Product Factors Assessor (V3 / SFDIPOT)
**Scope:** Read-only static analysis — no tests executed, no services started

---

## 1. Executive Summary

The community-social-network is a well-architectured NestJS DDD monolith that is code-complete across all nine delivery phases. The domain layer is genuinely excellent — aggregates are properly encapsulated, value objects enforce invariants, and business rules live where they belong. The infrastructure layer is structurally sound. However, three categories of production-blocking problems exist:

1. **Security theatre** — Admin 2FA accepts any six-digit integer. The socket gateway has a JWT verify path that is conditionally null. Token blacklisting is correct but the `/admin/auth/verify-2fa` endpoint obtains the admin ID from an unguarded HTTP header (`x-admin-id`), meaning the admin ID is caller-controlled.
2. **Stub cross-context wiring** — Four cross-context consumers exist but only two of the five event handlers actually persist data (`FollowRequested` and `MemberMentioned`). The other three log a message and return. `BlockContentFilterConsumer` never writes to Redis — block status is never enforced in the feed.
3. **Data-loss path** — `mediaIds` on `Publication` are always reconstituted as an empty array (confirmed in `publication.mapper.ts` line 48). A post with media uploaded is not crash-safe; after a process restart the media associations are gone.

---

## 2. SFDIPOT Matrix

| Factor | Rating | Confidence |
|--------|--------|-----------|
| Structure | 4 / 5 | High |
| Function | 3 / 5 | High |
| Data | 3 / 5 | High |
| Interfaces | 3 / 5 | High |
| Platform | 4 / 5 | Medium |
| Operations | 3 / 5 | High |
| Time | 3 / 5 | Medium |

**Composite score: 23 / 35 (66%)**

---

## 3. Structure Analysis (Rating: 4/5)

### 3.1 Aggregate Encapsulation

All twelve aggregates (`Member`, `Session`, `Publication`, `Discussion`, `Connection`, `Block`, `Group`, `Membership`, `Profile`, `Alert`, `Preference`, `AuditEntry`) follow the same correct DDD pattern:

- Private constructors with public static factory methods (`register()`, `create()`, `request()`)
- Separate `reconstitute()` static method that restores state without emitting domain events
- Version tracking through `incrementVersion()` on every state mutation
- Domain events collected via `addDomainEvent()` and not dispatched from within the aggregate
- Getters return defensive copies where collections are involved (`[...this._mentions]`, `new Map(this._reactionCounts)`)

The `Member` aggregate's `assertTransitionAllowed()` guard pattern, with explicit state machine checks before every status transition, is particularly well done.

### 3.2 Application / CQRS Layer

The 54 command/query handlers in `apps/api/src/modules/*/commands` and `*/queries` are consistent. Each handler is a plain injectable class. The post controller demonstrates correct pattern separation: it dispatches `CreatePostCommand` through `CommandBus` and reads via `QueryBus`.

**Deviation noted:** The admin module bypasses the CQRS buses. `AdminController` injects handler classes directly (e.g., `SuspendUserHandler`, `Verify2faHandler`) rather than dispatching through `CommandBus`. This is functionally equivalent but violates the stated CQRS architecture. Middleware, interceptors, and observability hooks that target the CQRS pipeline will not fire for admin actions.

### 3.3 Module Wiring (`AppModule`)

`AppModule` is complete:
- 7 infrastructure modules registered (TypeORM entities and repository providers)
- 7 application-layer context modules registered
- 2 cross-cutting modules: `PrivacyModule`, `UploadModule`
- 4 cross-context event consumers registered as providers
- Global JWT auth guard and throttler guard applied

No missing modules detected for the implemented feature set.

### 3.4 Base Repository

`BaseRepository.save()` uses a two-step "check then act" pattern: it counts the entity before deciding insert vs. update. This is not atomic — a race between two concurrent `save()` calls for a new aggregate could cause a duplicate insert attempt. The optimistic lock check on updates (version-conditioned UPDATE) is correct and atomic, but the insert path has a TOCTOU gap. For high-concurrency scenarios this should be replaced with `INSERT … ON CONFLICT DO UPDATE`.

---

## 4. Function Analysis (Rating: 3/5)

### 4.1 Endpoint Map (62 REST endpoints, 3 WebSocket events)

| Module | Endpoints | Notes |
|--------|-----------|-------|
| Auth | POST /register, POST /login, POST /refresh, POST /logout, GET /me | Complete |
| Profile | GET /profile/:id, GET /profile/member/:memberId, PUT /profile/:id, POST /profile/:id/avatar | Complete |
| Posts | POST /api/posts, GET /api/posts/:id, PUT /api/posts/:id, DELETE /api/posts/:id, GET /api/feed | Complete |
| Comments | POST /api/posts/:postId/comments, GET /api/posts/:postId/comments | No delete/edit comment |
| Reactions | POST/DELETE /api/posts/:postId/reactions, POST /api/comments/:commentId/reactions | No DELETE for comment reactions |
| Connections | POST/DELETE /api/connections/follow/:userId, POST approve/reject, GET followers/following/pending | Complete |
| Blocks | POST/DELETE /api/blocks/:userId, GET /api/blocks | Complete |
| Groups | Full CRUD + join/leave + members list + role management + kick + search | Complete |
| Notifications | GET list, GET unread-count, PUT :id/read, PUT read-all, GET/PUT preferences | Complete |
| Admin Auth | POST /admin/auth/login, POST /admin/auth/verify-2fa | 2FA broken |
| Admin | GET users, PUT suspend/unsuspend, GET audit-log, GET security-alerts, POST 2fa/setup, POST 2fa/verify | 2FA broken |
| Privacy (GDPR) | POST export-request, GET export/:id, POST delete-account, GET/PUT consents | Export state not crash-safe |
| Upload | POST image, POST avatar, DELETE :id | Complete |
| Health | GET /health, GET /health/live, GET /health/ready | Complete |
| Metrics | GET /metrics | Complete |

**Missing endpoints (functional gaps):**
- DELETE /api/comments/:id — users cannot delete their own comments
- DELETE /api/comments/:commentId/reactions — comment reaction removal not exposed
- GET /api/users/:id/posts — no public profile posts endpoint (only GET /api/posts/:id by ID)
- No search endpoint for posts or users (groups search exists)
- No email verification flow endpoints (`/api/auth/verify-email`, `/api/auth/resend-verification`)
- No password reset flow (`/api/auth/forgot-password`, `/api/auth/reset-password`)
- No admin endpoint for group management

### 4.2 Real-Time Features

The `SocketIOGateway` in `libs/infrastructure/messaging/src/socket-io.gateway.ts` is properly implemented:
- JWT auth on connection (token from `handshake.auth.token` or Authorization header)
- Personal room auto-join on connect (`user:{userId}`)
- Room join/leave message handlers with authorization check to prevent joining other users' personal rooms

**Critical gap:** `setJwtVerifyFn()` must be called externally at module init. The gateway stores `jwtVerifyFn = null` and throws `'JWT verify function not configured'` if it remains null. No call to `setJwtVerifyFn()` was found in the module files examined. If no module calls this on init, every WebSocket connection will be rejected with an internal error rather than an auth error.

The frontend `SocketProvider` correctly connects using `auth: { token: accessToken }` and retries up to 10 times. The `SocketQueryInvalidator` correctly invalidates TanStack Query caches on `notification:new`, `publication:created`, `discussion:created`, `connection:updated`, `group:updated`, `membership:updated`.

### 4.3 Admin 2FA (Critical Bug)

`Verify2faHandler.execute()` (line 39):
```
const isValidCode = /^\d{6}$/.test(command.code);
```
The comment on line 54 says "accept any valid 6-digit code in non-production environments." There is no environment guard. This executes identically in production. Any 6-digit string (e.g., `000000`) passes and returns a full admin JWT. The `TODO` on line 53 has not been implemented.

Additionally, `AdminAuthController.verify2fa()` reads the `adminId` from `req.headers['x-admin-id']`. Any caller who knows this header name can impersonate any admin ID — there is no temporary session token or server-side state tying the login step to the 2FA step.

### 4.4 Notification Delivery

Of five event handlers in `NotificationTriggerConsumer`:
- `onFollowRequested` — creates and persists an `Alert` aggregate (working)
- `onMemberMentioned` — creates and persists an `Alert` aggregate (working)
- `onPublicationCreated` — logs only, no Alert created, no follower fan-out
- `onDiscussionCreated` — logs only, no Alert created (comment is present: "When recipient is known, the full path would be...")
- `onReactionAdded` — logs only, no Alert created

Users do not receive notification for new posts by people they follow, for comments on their posts, or for reactions to their content. Only follow requests and mentions result in alerts in the database.

---

## 5. Data Analysis (Rating: 3/5)

### 5.1 Entity Index Coverage

| Entity | Primary Key | Unique Constraints | Foreign Key Indexes | Composite Indexes |
|--------|-------------|-------------------|--------------------|--------------------|
| members | uuid PK | email (unique) | — | IDX_members_status |
| sessions | uuid PK | — | member_id FK | IDX_sessions_member_active (member_id, revoked_at, expires_at) |
| publications | uuid PK | — | author_id (no FK!) | IDX_publications_status, created_at |
| publication_mentions | uuid PK | — | publication_id FK | IDX_publication_mentions_publication_id |
| publication_reactions | uuid PK | (publication_id, user_id) | publication_id FK | IDX_publication_reactions_publication_id |
| discussions | uuid PK | — | publication_id FK, parent_id FK (self) | IDX_discussions_author_id, created_at |
| connections | uuid PK | UQ(follower_id, followee_id) | — | IDX on follower_id, IDX on followee_id |
| blocks | uuid PK | — | — | needs verification |
| profiles | uuid PK | member_id (unique) | — | — |
| memberships | uuid PK | UQ(group_id, member_id) | — | IDX on group_id, IDX on member_id |
| alerts | uuid PK | — | — | IDX_alerts_recipient_status (recipient_id, status) |
| notification_preferences | uuid PK | member_id (unique) | — | — |

**Missing database foreign key constraints:**
- `publications.author_id` has no FK constraint to `members.id`. The migration creates an index but not a referential constraint. Deleted members' posts are orphaned silently.
- `connections.follower_id` and `connections.followee_id` have no FK constraints to `members.id`.
- `blocks` entity — FK constraints need confirmation.
- `alerts.recipient_id` has no FK constraint.
- `profiles.member_id` has no FK constraint.

Without FK constraints, referential integrity is enforced only at the application layer. A bug that inserts a connection for a non-existent user will not be caught by the database.

### 5.2 Soft Delete — Not Implemented

No entity uses `@DeleteDateColumn` or TypeORM's soft-delete feature. The `Publication` domain aggregate has `delete()` and `archive()` methods that set a status column. This means records that a user "deletes" remain in the database with `status = 'DELETED'`. This is acceptable only if queries consistently filter by status — which the `findByAuthorId` and feed queries need to be verified for.

The `Discussion` aggregate similarly has a status-based delete. Without soft-delete columns, audit queries and GDPR export (`DataExportService`) currently return deleted content, which may not be the expected behavior for a right-to-erasure flow.

### 5.3 mediaIds Data Loss

Confirmed from `publication.mapper.ts` line 46–48:
```typescript
// mediaIds are not stored in publication_reactions/mentions tables;
// placeholder empty array since the entity does not persist mediaIds separately yet
const mediaIds: string[] = [];
```

The `Publication` domain aggregate supports `mediaIds: string[]` and the `PublicationEntity` has no `media_ids` column. When a post is created with media, the IDs are held in-memory in the aggregate until the process restarts, after which they are permanently lost. The `PublicationCreatedEvent` also does not carry `mediaIds`, so there is no event-sourced recovery path.

### 5.4 GDPR Export State

`DataExportService` stores export requests in `private readonly exportRequests = new Map<string, ExportRequest>()`. This is instance-local in-memory state. A pod restart or horizontal scaling scenario means:
- A user submits an export request
- The pod that handled it restarts or another pod handles the polling request
- The export request is not found (`getExportRequest` returns null)

The comment in the source says "use Redis/DB in production" but this has not been implemented. The K8s deployment runs 2 replicas by default (HPA min: 2), guaranteeing this breaks immediately upon first GDPR export request in Kubernetes.

### 5.5 GDPR Export SQL Column Mismatch

`DataExportService.exportSocialGraphData()` queries:
```sql
SELECT * FROM connections WHERE requester_id = $1 OR addressee_id = $1
```

The actual `connections` table schema (from the migration) uses `follower_id` and `followee_id`, not `requester_id` and `addressee_id`. This query will always return zero rows, silently (due to `safeQuery()` swallowing errors). Users' connection data is never included in GDPR exports.

---

## 6. Interface Analysis (Rating: 3/5)

### 6.1 REST API Design

**Naming conventions:** Mostly consistent. A mixed pattern exists between modules:
- `PostController` uses explicit `api/` prefixes in the path string (`@Post('api/posts')`) while the controller is not decorated with a base path. This is unusual — if a global prefix is later added via `setGlobalPrefix('api')`, these routes would become `/api/api/posts`.
- `AuthController` uses `@Controller('api/auth')` with relative method routes (`@Post('register')`).
- `GroupController` uses `@Controller('api/groups')` with relative routes.
- Block and connection controllers use `@Controller('api/blocks')` and `@Controller('api/connections')`.

The pattern is inconsistent: some controllers own the `/api/` segment; others hardcode it in individual method decorators.

**HTTP method correctness:**
- `PUT /admin/users/:id/suspend` and `PUT /admin/users/:id/unsuspend` — these are state transitions, not full resource replacements. `POST` with a semantic sub-resource path (e.g., `POST /admin/users/:id/suspension`) or `PATCH` would be more RESTful. Not a breaking issue.
- `PUT /api/notifications/:id/read` — same pattern, acceptable for a state transition but could use `PATCH`.
- `POST /api/connections/approve/:connectionId` — semantically should be `PUT /api/connections/:connectionId` with a body indicating the new state, but the current form is unambiguous.

**Error response consistency:**
- The CQRS-based handlers throw NestJS exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`) which produce structured JSON errors automatically.
- The social graph controllers (block, connection) lack `@ApiTags` and `@ApiResponse` decorators. Swagger documentation for these endpoints is absent.

### 6.2 DTO Validation Coverage

Out of 35 DTO files, 19 use class-validator decorators. The 7 response DTOs (which do not need input validation) account for most of the gap. Input DTOs with no validation found:
- `profile/dto/upload-avatar.dto.ts` — no validation annotations (file upload DTO, but file constraints are not declared)

Strong validation examples:
- `RegisterDto` — `@IsEmail`, `@MinLength`/`@MaxLength` driven by domain constants, four `@Matches` regex guards for password complexity
- `LoginDto` — `@IsEmail`, `@IsString`

**Missing validation patterns:**
- Block and connection controllers accept raw `userId` path parameters without `ParseUUIDPipe` — a non-UUID string will pass to the handler and may cause a database error rather than a 400 Bad Request.
- `privacy.controller.ts` accepts `@Param('id') requestId` without `ParseUUIDPipe`.
- Upload controller's `@Param('id') fileKey` is a storage key, not a UUID, so `ParseUUIDPipe` would be wrong — but a format validation or sanitization guard is absent.

### 6.3 WebSocket Interface

The gateway exposes:
- `join-room` message handler
- `leave-room` message handler
- Emits: `notification:new`, `publication:created`, `discussion:created`, `connection:updated`, `group:updated`, `membership:updated` (from `SocketIOEventEmitter`)

The room authorization check (`if (room.startsWith('user:') && room !== 'user:${userId}')`) prevents users from joining other users' private rooms. Group and community rooms have no authorization check — any authenticated user can join `group:{any-id}`.

---

## 7. Platform Analysis (Rating: 4/5)

### 7.1 Docker Configuration

`apps/api/Dockerfile` is production-quality:
- Three-stage build (deps, build, production)
- `node:20-alpine` base
- `dumb-init` for proper PID 1 signal handling (SIGTERM propagation)
- Non-root user (`csn`, uid 1001)
- `HEALTHCHECK` using `wget` (appropriate for Alpine which lacks curl by default)
- Separate `--omit=dev` for production dependencies

`docker-compose.yml`:
- Health checks on all four services (api, web, postgres, redis)
- `depends_on` with `condition: service_healthy` — postgres and redis must be healthy before api starts
- Redis configured with `maxmemory 256mb`, `allkeys-lru`, and AOF enabled (good for a cache/queue hybrid use)
- Volumes for both postgres-data and redis-data

**Gap:** No `Bull` workers configuration. The docker-compose defines the API service but the Bull queue (used by `MessagingModule`) connects directly to Redis from within the API process. There is no dedicated Bull worker process defined. For a high-throughput notification fan-out, a separate worker pod would be needed.

### 7.2 Kubernetes Manifests

Manifests found: api deployment, api service, api HPA, web deployment, web service, postgres StatefulSet, postgres PVC, postgres service, redis deployment, redis service, ingress, configmap, secrets, migration job.

**Strengths:**
- HPA (min 2, max 10 replicas), scaling on CPU (70%) and memory (80%)
- `podAntiAffinity` (preferred) distributes API pods across nodes
- `terminationGracePeriodSeconds: 30` with a `preStop` sleep(5) to allow load balancer drain
- Both liveness and readiness probes point to `/health` (liveness) and `/health` (readiness) — though `/health/ready` would be more appropriate for readiness since it checks database and Redis connectivity

**Issue:** The readiness probe uses `/health` (the basic liveness response — always returns 200) not `/health/ready` which actually checks database and Redis. If the database is down, pods will report Ready and traffic will be routed to them despite being unable to serve requests.

**Issue:** `k8s/secrets.yaml` likely contains placeholder values. If committed to version control (which it appears to be), real secrets should not be placed there. The file should use Kubernetes Secret references or an external secret store.

### 7.3 Redis Usage

Redis is used for four distinct purposes:
1. Token blacklist (`token:blacklist:{jti}`)
2. Per-user token tracking (`token:user:{userId}:{jti}`)
3. Key rotation signing material (`auth:keys:{keyId}`)
4. Bull queue broker (via `MessagingModule`)
5. Idempotency store for event consumers

Using a single Redis instance for both Bull (which may delete keys) and token blacklisting (which requires reliable key expiry) is a risk. Redis `maxmemory-policy allkeys-lru` (configured in docker-compose) will evict any key regardless of TTL when memory pressure is high. A blacklisted token's key could be evicted before it expires, allowing a revoked JWT to be accepted again. Separate Redis databases or instances should be used for security-critical keys.

---

## 8. Operations Analysis (Rating: 3/5)

### 8.1 Health Checks

Three endpoints exist:
- `GET /health` — returns `{ status: 'ok', timestamp }` always (liveness)
- `GET /health/live` — identical to `/health`
- `GET /health/ready` — checks `SELECT 1` on the database and `redis.ping()`, returns `{ status: 'ready'|'degraded', checks: { database, redis } }`

The readiness endpoint correctly identifies partial failures and returns both statuses but does NOT return an HTTP 503 when degraded — it always returns 200. Kubernetes readiness probes depend on HTTP status codes, not body content. A degraded service returning 200 will not be removed from the load balancer pool.

### 8.2 Graceful Shutdown

`dumb-init` is used in Docker (correct). `terminationGracePeriodSeconds: 30` is set in Kubernetes. The `preStop` hook adds a 5-second delay. NestJS handles `SIGTERM` for graceful shutdown automatically when `app.enableShutdownHooks()` is called in `main.ts` (not verified in static analysis but standard NestJS).

### 8.3 Configuration Management

Direct `process.env` access is mostly isolated to infrastructure configuration helpers:
- `libs/infrastructure/auth/src/jwt.config.ts` — uses `process.env` extensively (JWT secrets, TTLs, issuer, audience). This is a NestJS `registerAs()` config factory, which is acceptable.
- `apps/api/src/modules/admin/admin.module.ts` — `process.env.JWT_SECRET ?? 'admin-jwt-secret-change-me'` — this is a raw `process.env` access outside of a config factory, and the fallback value is a weak default that will be used in production if the environment variable is not set.

`ConfigModule.forRoot({ isGlobal: true })` is configured. `ConfigService` usage was not found in application module files (0 occurrences in `apps/api/src/modules`), suggesting most env var reading bypasses `ConfigService`.

### 8.4 Logging

Pino logger via `LoggerService` in `libs/infrastructure/observability`. `correlation-id.middleware.ts` and `request-logger.middleware.ts` exist. Prometheus metrics via `MetricsService` and `MetricsController` (GET /metrics in Prometheus exposition format). These are solid production foundations.

**Not verified:** Whether the Pino logger is wired as the default NestJS logger in `main.ts`, and whether the correlation ID middleware is globally registered.

### 8.5 Rate Limiting

`ThrottlerModule.forRoot` configured in `AppModule` with three tiers:
- Short: 3 requests per second
- Medium: 20 requests per 10 seconds
- Long: 100 requests per minute

Applied globally via `APP_GUARD: ThrottlerGuard`. For a social network with infinite scroll (frequent feed polling), 3 requests/second is very tight and may cause legitimate rate limit errors on the frontend. The feed endpoint should have a higher individual limit or the short-tier limit should be increased.

---

## 9. Time Analysis (Rating: 3/5)

### 9.1 Concurrency

**Optimistic locking** is implemented in `BaseRepository` for all aggregates. The version-conditioned UPDATE is atomic. The TOCTOU gap in the insert path (count then insert, not atomic) is noted under Structure.

**Idempotency store** (`IdempotencyStore`) wraps event consumer handlers to prevent double-processing. This is correct for at-least-once delivery.

**No distributed locking** for operations that require mutual exclusion across replicas (e.g., checking if a user has already followed another user before creating a connection — the unique constraint on `(follower_id, followee_id)` in the database provides the backstop, but the handler logic may throw a non-user-friendly error when the constraint fires).

### 9.2 Token Lifecycle and Key Rotation

`KeyRotationService` implements rolling key rotation via Redis:
- Generates new key, demotes current key to "previous" with a 1-hour grace period
- Both current and previous keys accepted for verification
- Falls back to `config.accessSecret` if Redis is unavailable

However, the key rotation is not scheduled. There is no cron job or Bull job that calls `rotateKey()` periodically. The service is available via DI but has no automatic trigger. Key rotation happens on first startup only (initial key generation). No key is ever rotated after that unless triggered manually.

### 9.3 Session and Token Expiry

- Access token: 15 minutes (JWT_EXPIRATION or JWT_ACCESS_TTL)
- Refresh token: 7 days (JWT_REFRESH_EXPIRATION or JWT_REFRESH_TTL)
- Token blacklist TTL: set at blacklist time to match remaining token lifetime
- Session records in the `sessions` table track `expires_at` and `revoked_at`

Token blacklisting on logout is implemented correctly and uses Redis TTL for automatic cleanup.

### 9.4 Event Ordering

The `InProcessEventDispatcher` delivers domain events synchronously within the same transaction context. The `BullQueueEventPublisher` enqueues cross-context events to Bull queues for async delivery. There is no ordering guarantee for Bull messages — if two events are enqueued rapidly, consumers may process them out of order. For the current event types this is acceptable (follow request and mention notifications are idempotent), but could cause issues if event ordering semantics are added later.

### 9.5 Feed Query Performance

`GetFeedQuery` likely performs a JOIN across connections and publications tables. No caching layer was found for the feed query. With cursor-based pagination implemented (`PAGINATION.DEFAULT_PAGE_SIZE`), performance is acceptable at small scale. At high user counts, an activity fan-out strategy or Redis sorted set feed cache would be needed.

---

## 10. Feature Completeness Scorecard

| Feature Area | Status | Notes |
|---|---|---|
| Registration + login | Complete | Email verification not implemented |
| Password reset | Missing | No forgot-password flow |
| Email verification | Missing | Members start in `pendingVerification` status but no verification endpoint exists |
| Profile management | Complete | Avatar upload present |
| Post CRUD | Complete | mediaIds not persisted |
| Comment CRUD | Partial | No delete/edit comment |
| Reactions | Partial | Comment reaction delete not exposed |
| Feed (cursor-paginated) | Complete | No caching |
| Follow/Unfollow + approve/reject | Complete | |
| Block/Unblock | Complete (API) | Feed filter is a stub |
| Groups full CRUD | Complete | |
| Group membership + roles | Complete | |
| Group search | Complete | |
| Real-time notifications (WebSocket) | Partial | Gateway JWT wiring at risk; follow and mention alerts work; post/comment/reaction alerts are stubs |
| Notification preferences | Complete | |
| Admin login | Complete | |
| Admin 2FA | Broken | Any 6-digit code accepted; admin ID from untrusted header |
| Admin user management | Complete | |
| Admin audit log | Complete | |
| GDPR data export | Partial | In-memory state; SQL column name mismatch for connections |
| GDPR data erasure | Present | Correctness not verified in this analysis |
| GDPR consent management | Present | |
| File/image upload | Complete | |
| User search | Missing | |
| Post search | Missing | |
| Password change | Missing | |

---

## 11. Production Readiness Checklist

| Category | Item | Status |
|---|---|---|
| Security | Admin 2FA actually validates TOTP code | FAIL |
| Security | Admin session intermediation (prevent ID header spoofing) | FAIL |
| Security | Redis `allkeys-lru` can evict token blacklist entries | RISK |
| Security | Weak JWT secret fallback in admin module | RISK |
| Security | No CSRF protection identified | UNVERIFIED |
| Security | Unauthenticated room join for group rooms in WebSocket gateway | RISK |
| Data Integrity | mediaIds column absent from publications table | FAIL |
| Data Integrity | No FK constraint from publications.author_id to members.id | RISK |
| Data Integrity | No FK constraints on connections, alerts, profiles | RISK |
| Data Integrity | GDPR export SQL uses wrong column names for connections | FAIL |
| Availability | GDPR export state not crash-safe (in-memory Map) | FAIL |
| Availability | Readiness probe HTTP 200 even when degraded | FAIL |
| Availability | WebSocket gateway JWT verify function may be null | RISK |
| Availability | Key rotation never triggered after initial startup | RISK |
| Observability | Prometheus metrics endpoint exposed without auth | ACCEPTABLE |
| Observability | Pino logger wiring in main.ts not verified | UNVERIFIED |
| Observability | Correlation ID middleware global registration not verified | UNVERIFIED |
| Operations | Email verification flow for new registrations | MISSING |
| Operations | Password reset flow | MISSING |
| Operations | Rate limit (3 req/s) may reject legitimate feed scrolling | RISK |
| Cross-context | Block filter never written to Redis — blocks not enforced in feed | FAIL |
| Cross-context | Post notifications never sent to followers | FAIL |
| Cross-context | Comment notifications never sent to post authors | FAIL |
| Cross-context | Reaction notifications never sent to content authors | FAIL |
| Infrastructure | K8s readiness probe uses `/health` not `/health/ready` | FAIL |
| Infrastructure | No scheduled job to rotate signing keys | RISK |

---

## 12. Top 10 Product Risks

Ranked by severity (likelihood x impact):

**Risk 1 — CRITICAL: Admin 2FA is non-functional**
Any person who obtains an admin email/password can gain full admin access by entering any six-digit number. Combined with the `x-admin-id` header issue, an attacker only needs to know a valid admin ID to skip even the password step on the 2FA verify endpoint. This is a critical authentication bypass in the admin plane.

**Risk 2 — CRITICAL: Block enforcement is absent**
A user who blocks another user expects that user's content to disappear from their feed. `BlockContentFilterConsumer` logs the event but never writes to Redis. No feed query checks a block list. A harassed user who blocks an abuser will continue to see their content. This is both a safety failure and a product failure.

**Risk 3 — HIGH: mediaIds are permanently lost on restart**
The `publication.mapper.ts` hardcodes `mediaIds = []`. Any post created with images will lose its media association on the first process restart or pod cycle. In a Kubernetes deployment with rolling updates every deploy cycle, this means media is reliably lost. Images become orphaned in S3.

**Risk 4 — HIGH: GDPR export is broken in multi-replica deployments**
The export request state lives in a per-instance `Map`. With HPA min replicas set to 2, the pod that receives the status poll request will return null for requests created by another pod. Users initiating GDPR data exports will receive an empty response or not-found error.

**Risk 5 — HIGH: Notification delivery is 60% stubbed**
Three of five cross-context notification types (post published, comment added, reaction added) log a message and return without persisting an alert. Users do not receive notifications for the most common interactions on the platform. The product appears to work but notifications are silent.

**Risk 6 — HIGH: Email verification and password reset flows are absent**
New members are created in `pendingVerification` status but no endpoint exists to verify an email. There is no forgot-password or reset-password flow. Members who forget their password have no recovery path. Members may be stuck in unverified status with no way to activate.

**Risk 7 — MEDIUM: K8s readiness probe uses liveness endpoint**
`/health` always returns HTTP 200. When the database or Redis is unavailable, the API pod is still routed traffic. Requests fail at the handler level rather than being shed by the load balancer. Combined with the 2-replica minimum, a database restart will result in all requests failing for the duration of reconnection.

**Risk 8 — MEDIUM: Token blacklist can be evicted by Redis memory pressure**
The Redis instance is configured with `allkeys-lru`. At memory pressure, the LRU policy will evict any key, including token blacklist entries. A user who logs out could have their blacklisted token evicted before expiry, allowing reuse. This is a session revocation bypass.

**Risk 9 — MEDIUM: Missing delete/edit on comments and no user/post search**
Users can create comments but cannot delete or edit them. There is no global search for users or posts (only group search exists). These are table-stakes social network features and their absence will be immediately visible to users.

**Risk 10 — MEDIUM: WebSocket gateway JWT verify function may be null**
`SocketIOGateway.jwtVerifyFn` initializes to null. If the module that should call `setJwtVerifyFn()` fails to do so, every WebSocket connection is rejected with an internal error (`'JWT verify function not configured'`), not a proper 401. Real-time features are silently unavailable.

---

## 13. MVP vs. Nice-to-Have Distinction

### MVP (Must Fix Before Launch)

| ID | Item | Affected Component |
|----|------|--------------------|
| M1 | Implement TOTP validation in Verify2faHandler | `verify-2fa.handler.ts` |
| M2 | Use a server-side temporary token (not x-admin-id header) to bind 2FA verify to login | `admin-auth.controller.ts`, `verify-2fa.handler.ts` |
| M3 | Add `media_ids` column (text[] or jsonb) to publications table and update mapper | `publication.entity.ts`, `publication.mapper.ts`, migration |
| M4 | Persist GDPR export requests to Redis or a database table | `data-export.service.ts` |
| M5 | Fix GDPR export SQL for connections (follower_id/followee_id) | `data-export.service.ts` |
| M6 | Implement block filter write to Redis in BlockContentFilterConsumer | `block-content-filter.consumer.ts` |
| M7 | Implement feed query block filter read from Redis | `get-feed.handler.ts` |
| M8 | Implement comment notification in onDiscussionCreated | `notification-trigger.consumer.ts` |
| M9 | Implement reaction notification in onReactionAdded | `notification-trigger.consumer.ts` |
| M10 | Implement post notification fan-out in onPublicationCreated | `notification-trigger.consumer.ts` |
| M11 | Fix K8s readiness probe to use `/health/ready` and return HTTP 503 when degraded | `k8s/api/deployment.yaml`, `health.controller.ts` |
| M12 | Add email verification flow (send token on register, POST /auth/verify-email) | New endpoints + email template |
| M13 | Add password reset flow (POST /auth/forgot-password, POST /auth/reset-password) | New endpoints + email template |
| M14 | Use separate Redis DB indices or instances for token blacklist vs. Bull queues | `redis.module.ts`, `messaging.module.ts` |

### High Priority (First Sprint Post-Launch)

| ID | Item |
|----|------|
| H1 | Add comment delete endpoint (DELETE /api/comments/:id) |
| H2 | Add comment edit endpoint (PUT /api/comments/:id) |
| H3 | Add comment reaction delete endpoint (DELETE /api/comments/:commentId/reactions) |
| H4 | Add user search endpoint |
| H5 | Add post search endpoint |
| H6 | Add ParseUUIDPipe to block and connection controllers' path parameters |
| H7 | Verify and wire SocketIOGateway.setJwtVerifyFn() during module init |
| H8 | Add FK constraints from publications.author_id, connections.follower_id/followee_id, alerts.recipient_id to members.id |
| H9 | Implement key rotation scheduling (cron or Bull job) |
| H10 | Replace admin module process.env.JWT_SECRET with ConfigService |

### Nice-to-Have (Future Roadmap)

| ID | Item |
|----|------|
| N1 | API versioning (ADR P3 gap) |
| N2 | Post/notification caching layer (Redis sorted sets for feeds) |
| N3 | Dedicated Bull worker process in Docker/K8s separate from API process |
| N4 | Group room authorization in WebSocket gateway |
| N5 | Replace BaseRepository TOCTOU insert with atomic UPSERT |
| N6 | Soft-delete columns on publications and discussions for audit completeness |
| N7 | Rate limit tuning per-endpoint (higher limits for feed, lower for auth) |
| N8 | Secrets management via external store (Vault, AWS Secrets Manager) |
| N9 | Password change endpoint (PUT /api/auth/password) |
| N10 | Admin group management endpoints |

---

## 14. Test Ideas by SFDIPOT Category (Priority-Ordered)

### Structure

| Priority | Test Idea |
|----------|-----------|
| P0 | Reconstitute a `Member` aggregate from persistence, call `suspend()`, call `reconstitute()` again — confirm domain events are not re-emitted and version is preserved |
| P0 | Submit two concurrent `save()` calls for the same new aggregate — confirm no duplicate insert and the second receives a conflict error |
| P1 | Create a `Publication`, call `delete()`, then call `edit()` — confirm `CannotEditError` is thrown |
| P1 | Dispatch 100 concurrent `UpdatePostCommand` for the same post — confirm exactly one succeeds and the rest receive `OptimisticLockError` |
| P2 | Admin controller dispatches `SuspendUserCommand` directly — confirm audit log is written via the handler, not via CQRS middleware hooks |

### Function

| Priority | Test Idea |
|----------|-----------|
| P0 | POST /admin/auth/verify-2fa with code `123456` — confirm HTTP 401 is returned (not 200 with a token) — this test is expected to FAIL currently |
| P0 | POST /admin/auth/verify-2fa with header `x-admin-id: {admin-id-of-another-admin}` after logging in as a different admin — confirm the token is for the logged-in admin, not the spoofed ID |
| P0 | Create a post, block the author from another account, fetch feed — confirm blocked author's posts do not appear |
| P0 | Create a post with mediaIds, restart the API process, fetch the post — confirm media IDs are present in the response |
| P0 | User A follows User B; confirm User B receives a notification in the alerts table; User A comments on User B's post; confirm User B receives a comment notification |
| P1 | Register a new member, attempt to login before email verification — confirm the response is 403 with a clear message (note: verification flow does not exist yet, so this will reveal the gap) |
| P1 | WebSocket client connects without a token — confirm `error` event is emitted and socket is disconnected |
| P1 | Authenticated user calls GET /api/feed — confirm blocked users' posts are absent |
| P2 | User A comments on their own post then deletes the comment (note: delete endpoint missing — this confirms the gap) |
| P2 | Admin sets up 2FA with POST /admin/2fa/setup — confirm a TOTP secret is stored and subsequent verify requires the correct TOTP code |

### Data

| Priority | Test Idea |
|----------|-----------|
| P0 | Insert a publication row directly via SQL with author_id pointing to a non-existent member ID — confirm the database rejects it (will fail without FK constraint) |
| P0 | Create a GDPR export request, stop the pod, start a new pod, poll the export request ID — confirm the status is retrievable |
| P0 | Request GDPR data export, confirm connections data uses follower_id/followee_id column names and returns actual data |
| P1 | Create a post with content at exactly `CONTENT_LIMITS.MAX_CONTENT_LENGTH` characters — confirm it is accepted; add one character — confirm 400 |
| P1 | Create a publication with 10 mentions (at `MAX_MENTIONS_PER_CONTENT`), add one more — confirm `MaxMentionsExceededError` |
| P2 | Submit a reaction for a post; submit the same reaction type again from the same user — confirm only one reaction exists in the database |
| P2 | Create a member, delete all their publications via the API, export GDPR data — confirm publications list is empty in the export |

### Interfaces

| Priority | Test Idea |
|----------|-----------|
| P0 | POST /api/blocks/not-a-uuid with a non-UUID string — confirm HTTP 400 (will return 500 or pass-through without ParseUUIDPipe) |
| P0 | POST /api/connections/follow/not-a-uuid — confirm HTTP 400 |
| P1 | GET /api/posts/{valid-uuid} with an expired but not-blacklisted JWT (token from before logout) — confirm 401 |
| P1 | GET /api/posts/{valid-uuid} with a blacklisted JWT — confirm 401 |
| P2 | Swagger UI at /api-docs renders all 62 endpoints with request/response schemas — confirm social-graph controllers appear (they lack @ApiTags) |
| P2 | PUT /api/posts/:id where the requesting user is not the author — confirm 403 |

### Platform

| Priority | Test Idea |
|----------|-----------|
| P0 | Deploy with HPA (2 replicas), submit a GDPR export request to pod 1, poll status from pod 2 — confirm the request is found |
| P0 | Fill Redis to max memory (256MB), blacklist a token, wait for LRU eviction pressure, attempt to use the blacklisted token — confirm it is still rejected |
| P1 | Stop the PostgreSQL container, call GET /health/ready — confirm HTTP 503 is returned (will return 200 currently) |
| P1 | Build the Docker image, run `docker inspect` to confirm the process runs as uid 1001 (non-root) |
| P2 | Deploy to K8s, trigger a rolling update, confirm zero-downtime (preStop sleep provides drain window) |

### Operations

| Priority | Test Idea |
|----------|-----------|
| P0 | New user registers, navigates to their feed, creates a post, comments on it, follows another user — complete happy path with no errors |
| P0 | Admin logs in, attempts to suspend a user, verify suspension is reflected in subsequent user login attempt (403) |
| P1 | User registers with an email that is already in use — confirm HTTP 409 and appropriate error message |
| P1 | User submits 4 rapid login attempts with wrong password — confirm the 4th triggers the lockout and subsequent attempts with correct password return 403 locked |
| P2 | Group owner creates a group, invites members, promotes a member to moderator, then kicks them — confirm correct roles at each step |

### Time

| Priority | Test Idea |
|----------|-----------|
| P0 | Submit 50 concurrent follow requests from different users to the same target user — confirm each results in a unique connection record and no duplicate key errors |
| P0 | Create two sessions for the same user; blacklist-all via logout; confirm both sessions are rejected |
| P1 | Simulate Bull queue consumer failure for `FollowRequested` event — confirm the event is retried and eventually processed (idempotency key prevents duplicate alerts) |
| P2 | Log out and log back in within the 15-minute access token window — confirm the old access token is blacklisted and rejected while the new one is accepted |

---

*Analysis based on static code review. No tests were executed and no live services were contacted. Ratings reflect code-as-written quality; actual runtime behavior may differ.*
