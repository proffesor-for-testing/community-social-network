# Security Audit Report — Community Social Network

**Audit Date**: 2026-04-21  
**Auditor**: V3 QE Security Auditor (claude-sonnet-4-6)  
**Branch Audited**: `ddd-approach`  
**Scope**: Full codebase — `libs/`, `apps/api/src/`, `apps/web/src/`, `package.json`  
**Standard**: OWASP Top 10 2021, GDPR compliance, general secure-coding practices

---

## Executive Summary

The Community Social Network is a NestJS modular monolith with a well-structured DDD approach. The authentication infrastructure for regular users is well-engineered (key rotation, token blacklisting, bcrypt at 12 rounds, JTI-based revocation). However, the **admin subsystem has critical security defects** that would allow any authenticated user to claim admin privileges, and the **Helmet HTTP security headers are completely absent**. In addition, two credential-containing `.env` files are committed to the git repository.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 7 |
| Low | 5 |
| Info | 3 |
| **Total** | **23** |

**Overall Risk Rating: HIGH** — production deployment is not recommended until C-01, C-02, and C-03 are resolved.

---

## Risk Matrix

```
Likelihood →        Low         Medium      High
                ┌───────────┬───────────┬───────────┐
Impact          │           │  C-03     │  C-01     │
High          ↑ │           │  H-01     │  C-02     │
                ├───────────┼───────────┼───────────┤
                │  M-03     │  M-01     │  H-02     │
Medium        ↑ │  M-04     │  M-05     │  H-03     │
                │           │  M-06     │  H-04     │
                ├───────────┼───────────┼───────────┤
                │  L-01     │  L-02     │           │
Low           ↑ │  L-03     │  M-07     │           │
                │  L-04,L-05│           │           │
                └───────────┴───────────┴───────────┘
```

---

## Vulnerability Catalog

### CRITICAL Findings

---

#### C-01 — Admin 2FA Is Completely Bypassed (Non-Functional)

**OWASP**: A07:2021 – Identification and Authentication Failures  
**CVSS Score**: 9.8 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)  
**File**: `apps/api/src/modules/admin/commands/verify-2fa.handler.ts`  

**Description**  
The `Verify2faHandler.execute()` validates only that the code matches `/^\d{6}$/` — any six-digit string passes. No TOTP secret is generated, stored, or verified. The comment in the source explicitly acknowledges this: *"For now, accept any valid 6-digit code in non-production environments."* The `setup-2fa.handler.ts` likewise stubs the setup flow, never generating a TOTP secret or QR code. The `admin-login.handler.ts` sets `requiresTwoFactor: false` unconditionally. This renders the entire 2FA requirement ineffective.

**Lines**  
- `apps/api/src/modules/admin/commands/verify-2fa.handler.ts:39` — format-only check  
- `apps/api/src/modules/admin/commands/setup-2fa.handler.ts:34` — TODO, no secret generation  
- `apps/api/src/modules/admin/commands/admin-login.handler.ts:102` — `requiresTwoFactor: false`

**Impact**  
Any attacker who obtains admin credentials can authenticate without a second factor.

**Remediation**  
1. Integrate `speakeasy` or `otplib` for TOTP secret generation.  
2. Store the encrypted TOTP secret per-admin (separate `admin_2fa_secrets` table).  
3. In `verify-2fa.handler.ts`, call `totp.verify({ secret, encoding: 'base32', token: command.code })`.  
4. Set `requiresTwoFactor: true` in the login response and enforce it on subsequent admin API calls via a guard claim (`twoFactorVerified === true`).

---

#### C-02 — Admin 2FA Verify Accepts Client-Supplied adminId — Privilege Escalation

**OWASP**: A01:2021 – Broken Access Control  
**CVSS Score**: 9.1 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H)  
**File**: `apps/api/src/modules/admin/controllers/admin-auth.controller.ts:50`

**Description**  
The `POST /admin/auth/verify-2fa` endpoint reads `adminId` from the `x-admin-id` HTTP header supplied by the client, with zero authentication:

```typescript
const adminId = req.headers['x-admin-id'] as string;
```

Since 2FA validation is also bypassed (C-01), any caller can POST with `x-admin-id: <target-uuid>` and any six-digit code, and receive a fully-signed admin JWT scoped to the chosen `adminId`. This is an unauthenticated privilege escalation path to admin access for any known user UUID.

**Remediation**  
1. Issue a short-lived, signed *pre-2FA session token* during the initial `/admin/auth/login` step that encodes `adminId`, and require that token in the 2FA verification step.  
2. Never trust client-supplied identity headers for authentication.  
3. Enforce the real TOTP check (C-01 fix) as an additional layer.

---

#### C-03 — Credential Files Committed to Git Repository

**OWASP**: A02:2021 – Cryptographic Failures / Secrets Exposure  
**CVSS Score**: 8.1 (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N)  
**Files**: `.env.development`, `.env.test` (confirmed via `git ls-files`)

**Description**  
Two environment files containing database credentials, JWT secrets, and S3 keys are committed to the git repository. `.gitignore` excludes `.env` and `.env.*.local` but does **not** exclude `.env.development` or `.env.test`.

Committed secrets include:
- `DB_PASSWORD=postgres`
- `JWT_SECRET=dev-jwt-secret-change-in-production`
- `JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production`
- `JWT_SECRET=test-jwt-secret-for-testing-only`
- `S3_ACCESS_KEY=test-access-key`, `S3_SECRET_KEY=test-secret-key`

Although these are labelled "dev/test", the git history permanently preserves them. If the same secrets are reused in production (a common accident), they are now public.

**Remediation**  
1. Add to `.gitignore`:
   ```
   .env.development
   .env.test
   .env.production
   ```
2. Remove the files from git tracking: `git rm --cached .env.development .env.test`
3. Rotate all secrets that have ever been in these files, especially if any were reused.
4. Replace with `.env.*.example` templates containing placeholder values.
5. Use a secrets manager (Vault, AWS Secrets Manager) or CI secret injection for all environments.

---

### HIGH Findings

---

#### H-01 — HTTP Security Headers Absent (Helmet Not Applied)

**OWASP**: A05:2021 – Security Misconfiguration  
**CVSS Score**: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N)  
**File**: `apps/api/src/main.ts`

**Description**  
`helmet` is listed in `package.json` dependencies (v8.1.0) but is never imported or applied in `main.ts`. The following security headers are absent from all API responses:
- `Content-Security-Policy`
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-Permitted-Cross-Domain-Policies`
- `Referrer-Policy`

This exposes the API to clickjacking, MIME-sniffing, and man-in-the-middle attacks.

**Remediation**  
Add to `apps/api/src/main.ts`, before the `app.listen()` call:
```typescript
import helmet from 'helmet';
// ...
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

---

#### H-02 — Admin Module Uses Hardcoded Fallback JWT Secret

**OWASP**: A02:2021 – Cryptographic Failures  
**CVSS Score**: 7.3 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N)  
**File**: `apps/api/src/modules/admin/admin.module.ts:33`

**Description**  
The admin module registers its own `JwtModule` with a hardcoded fallback secret:

```typescript
JwtModule.register({
  secret: process.env.JWT_SECRET ?? 'admin-jwt-secret-change-me',
  signOptions: { expiresIn: '15m' },
}),
```

This is separate from the main user JWT key-rotation system. If `JWT_SECRET` is unset (common in development), the admin JWT is signed with the public literal string `'admin-jwt-secret-change-me'`. An attacker can forge valid admin tokens offline with this known secret.

Additionally, the admin uses `JWT_SECRET` (the *user* access secret) rather than a dedicated `JWT_ADMIN_SECRET`, meaning a compromise of the user token secret also compromises the admin path.

**Remediation**  
1. Add a dedicated `JWT_ADMIN_SECRET` environment variable.  
2. Throw at startup if it is not set in any environment (not just production).  
3. Remove the hardcoded fallback entirely:
   ```typescript
   const adminSecret = process.env.JWT_ADMIN_SECRET;
   if (!adminSecret) throw new Error('JWT_ADMIN_SECRET is required');
   JwtModule.register({ secret: adminSecret, signOptions: { expiresIn: '15m' } });
   ```

---

#### H-03 — X-Forwarded-For Trusted Unconditionally — IP Spoofing for Rate Limiting and Audit Logs

**OWASP**: A05:2021 – Security Misconfiguration / A09:2021 – Security Logging Failures  
**CVSS Score**: 6.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:M/A:L)  
**Files**: `apps/api/src/modules/admin/controllers/admin-auth.controller.ts:63`, `apps/api/src/modules/admin/controllers/admin.controller.ts:182`

**Description**  
Both admin controllers extract the caller's IP from the raw `x-forwarded-for` header without verifying whether Express has been configured to trust a proxy:

```typescript
const forwarded = req.headers['x-forwarded-for'];
if (typeof forwarded === 'string') {
  return forwarded.split(',')[0].trim();
}
return req.ip ?? '127.0.0.1';
```

Without `app.set('trust proxy', 1)` in `main.ts`, an attacker can set arbitrary values in `x-forwarded-for` to:
1. Poison the audit log with a false source IP.
2. Potentially bypass IP-based rate limiting if the Throttler is configured to key on IPs.

**Remediation**  
Either configure Express trust proxy:
```typescript
// main.ts
app.set('trust proxy', 1); // trust first proxy only
```
Or strip the IP from `req.ip` (which Express sets correctly when proxy trust is configured) and remove the manual header parsing in the controllers.

---

#### H-04 — Admin Login Endpoint Lacks Dedicated Rate Limiting

**OWASP**: A07:2021 – Identification and Authentication Failures  
**CVSS Score**: 6.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N)  
**File**: `apps/api/src/modules/admin/controllers/admin-auth.controller.ts`

**Description**  
The global throttler applies `{ name: 'short', ttl: 1000, limit: 3 }` (3 req/s), `{ name: 'medium', ttl: 10000, limit: 20 }` (20/10s), and `{ name: 'long', ttl: 60000, limit: 100 }` (100/min). For admin login this is far too permissive — a slow brute-force (1 req/2s) hits ~30 attempts/minute against admin credentials. No `@Throttle` override with stricter limits is applied to `AdminAuthController`.

**Remediation**  
Apply a strict throttle to the admin auth controller:
```typescript
@Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 attempts per 15 minutes
@Controller('admin/auth')
export class AdminAuthController { ... }
```
Combine with account-lockout after N consecutive failures.

---

#### H-05 — Admin Role Not Segregated From Regular Member Records

**OWASP**: A01:2021 – Broken Access Control  
**CVSS Score**: 6.3 (CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:L/A:N)  
**File**: `apps/api/src/modules/admin/commands/admin-login.handler.ts:53–57`

**Description**  
The comment in `admin-login.handler.ts` acknowledges the architectural flaw explicitly:

> *"In a full implementation, admin role would be verified from a separate admin table or role field on the member."*

Currently any member record can be used to authenticate as admin if credentials match — there is no `isAdmin`, `role`, or separate admin-credential check beyond password comparison against the same `members` table. The `AdminRole.ADMIN` is always assigned unconditionally in the JWT payload.

**Remediation**  
1. Add an `admin_accounts` table (separate from `members`) or an `is_admin` flag on `members` that is only set via a protected bootstrap/seed process.  
2. In `AdminLoginHandler`, check this flag/table before issuing an admin JWT.  
3. Alternatively, maintain a separate admin credentials store with its own bcrypt hashes.

---

### MEDIUM Findings

---

#### M-01 — TypeORM `synchronize: true` Enabled in Development

**OWASP**: A05:2021 – Security Misconfiguration  
**CVSS Score**: 5.9  
**File**: `libs/infrastructure/database/src/database.config.ts:16`

**Description**  
```typescript
synchronize: process.env['NODE_ENV'] === 'development',
```

If `NODE_ENV` is unset or incorrectly set to `'development'` in a shared staging or production environment, TypeORM will auto-sync the schema, potentially causing data loss or schema corruption.

**Remediation**  
Disable synchronize unconditionally and rely on explicit migrations:
```typescript
synchronize: false,
migrationsRun: true,
```

---

#### M-02 — Socket.IO `join-room` Allows Joining Arbitrary Rooms

**OWASP**: A01:2021 – Broken Access Control  
**CVSS Score**: 5.4  
**File**: `libs/infrastructure/messaging/src/socket-io.gateway.ts:119–138`

**Description**  
The `join-room` handler prevents joining `user:*` rooms for other users, but allows joining any other room name without restriction:

```typescript
if (room.startsWith('user:') && room !== `user:${userId}`) {
  // blocked
}
await client.join(room); // all other room names are unrestricted
```

A user can join `admin:`, `group:any-group-id`, or any internally used broadcast room.

**Remediation**  
Apply a positive allowlist for room name formats a user may join:
```typescript
const allowedRoomPattern = /^(user:[a-f0-9-]+|group:[a-f0-9-]+)$/;
if (!allowedRoomPattern.test(room)) {
  return { event: 'join-room', data: { success: false } };
}
// Then check membership if room is a group room
```

---

#### M-03 — GDPR Export Data Stored In-Memory (Server-Restart Loss, Multi-Instance Unsafe)

**OWASP**: A04:2021 – Insecure Design  
**CVSS Score**: 5.3  
**File**: `libs/infrastructure/gdpr/src/data-export.service.ts:24`

**Description**  
```typescript
private readonly exportRequests = new Map<string, ExportRequest>();
```

Export request state and all exported PII data live in a process-local `Map`. Data is lost on every server restart, unavailable in multi-instance deployments, and unbounded in memory consumption (no eviction). GDPR Article 20 requires the exported data to be reliably retrievable.

**Remediation**  
1. Store export requests and their status in the `export_requests` database table.  
2. Write completed export data to S3 (presigned URL with short TTL for download) or persist to a secure ephemeral storage.  
3. Process exports via a Bull queue to handle retries and persistence.

---

#### M-04 — No Email Verification on Registration

**OWASP**: A07:2021 – Identification and Authentication Failures  
**CVSS Score**: 5.3  
**File**: `apps/api/src/modules/identity/commands/register-member.handler.ts:50`

**Description**  
```typescript
member.activate(); // Activate member immediately (skip email verification for MVP)
```

No email ownership verification occurs. Any email address (including ones the registrant doesn't own) can be used to create an active account. This enables spam, account squatting, and makes account recovery impossible for legitimate owners.

**Remediation**  
1. Set member status to `PENDING_VERIFICATION` on registration.  
2. Send an email with a signed, time-limited verification token.  
3. Provide a `GET /api/auth/verify-email?token=<token>` endpoint that activates the account.

---

#### M-05 — Session IP Hardcoded as `0.0.0.0`

**OWASP**: A09:2021 – Security Logging and Monitoring Failures  
**CVSS Score**: 4.3  
**File**: `apps/api/src/modules/identity/commands/login-member.handler.ts:54`

**Description**  
```typescript
const session = Session.create(sessionId, member.id, 'api', '0.0.0.0', expiresAt);
```

Session records always store `0.0.0.0` as the IP address. This prevents any meaningful session anomaly detection or post-incident forensics.

**Remediation**  
Pass the real client IP to the `LoginMemberCommand` from the controller (via `req.ip` after configuring trust proxy), and use it in `Session.create`.

---

#### M-06 — Admin Audit Log Includes Plaintext Email

**OWASP**: A09:2021 – Security Logging and Monitoring Failures  
**CVSS Score**: 4.0  
**File**: `apps/api/src/modules/admin/commands/admin-login.handler.ts:84–88`

**Description**  
```typescript
await this.logAuditEntry(
  'ADMIN_LOGIN_SUCCESS',
  member.id.value,
  'Member',
  { email: command.email },  // PII in audit log details
  command.ipAddress,
);
```

The `details` field of audit log entries stores the admin's email address. The redaction config (`logger.config.ts`) covers `body.password`, `body.token`, but not structured audit entry details. GDPR requires minimization of PII in logs.

**Remediation**  
Remove `email` from audit entry details, or use a one-way hash of the email for correlation:
```typescript
{ emailHash: createHash('sha256').update(command.email).digest('hex') }
```

---

#### M-07 — Database SSL Not Configured

**OWASP**: A02:2021 – Cryptographic Failures  
**CVSS Score**: 4.8  
**File**: `libs/infrastructure/database/src/database.config.ts`

**Description**  
The TypeORM configuration contains no `ssl` setting. In production, database connections will be unencrypted unless the database server enforces SSL by default. Credentials and query results would be exposed to network eavesdropping on unencrypted infrastructure.

**Remediation**  
Add SSL configuration:
```typescript
ssl: process.env['NODE_ENV'] === 'production'
  ? { rejectUnauthorized: true, ca: process.env['DB_SSL_CA'] }
  : false,
```

---

### LOW Findings

---

#### L-01 — `synchronize: true` Without Explicit Startup Warning

**File**: `libs/infrastructure/database/src/database.config.ts:16`  
TypeORM synchronize fires silently. Add a startup `console.warn` or `Logger.warn` when synchronize is enabled so it is obvious during development.

---

#### L-02 — Weak Default Redis: No Password

**File**: `libs/infrastructure/cache/src/redis.config.ts:18`  
`REDIS_PASSWORD: process.env['REDIS_PASSWORD'] || undefined` — no password is set by default. In containerized environments reachable within a network, an unauthenticated Redis can be used to read/write the token blacklist, the key rotation store, and all cached data.

**Remediation**: Require `REDIS_PASSWORD` in production environments.

---

#### L-03 — SVG Detection in Magic Bytes Validator With No Sanitization

**File**: `libs/infrastructure/storage/src/magic-bytes-validator.ts:31–33`  
SVG signatures are in the `SIGNATURES` array but SVG is not in `ALLOWED_IMAGE_TYPES` or `ALLOWED_AVATAR_TYPES`, so SVG is correctly blocked for images. However if SVG were ever added to an allowed set, the validator would not prevent embedded `<script>` payloads. Document this risk so it is not inadvertently enabled.

---

#### L-04 — `delete-account` Partial Failure Leaks Error Details to Client

**File**: `apps/api/src/modules/privacy/privacy.controller.ts:104–109`  
```typescript
throw new ForbiddenException({
  message: 'Account deletion partially completed',
  contextsProcessed: result.contextsProcessed,
  errors: result.errors,
});
```
The `errors` array may contain database error messages (table names, constraint names) that are useful to an attacker for reconnaissance. Return a generic message and log the details server-side.

---

#### L-05 — Metrics Endpoint Lacks Authentication

**File**: `libs/infrastructure/observability/src/metrics.controller.ts` (inferred from observability module)  
Prometheus metrics endpoints (`/metrics`) typically expose operational details (request rates, error rates, queue depths) that aid attacker reconnaissance. If this endpoint is registered globally, it should be restricted to internal network access or require a bearer token.

---

### Informational Findings

---

#### I-01 — Access Token Returned in Response Body (Not httpOnly Cookie)

**File**: `apps/api/src/modules/identity/dto/auth-response.dto.ts`  
`accessToken` and `refreshToken` are returned in the JSON response body. The system description mentions httpOnly cookies as the design intent, but the implementation uses Bearer tokens in Authorization headers stored in JavaScript-accessible storage (LocalStorage/Zustand store). While this is acceptable for a SPA with proper XSS mitigations, it is higher risk than httpOnly cookies. The `MEMORY.md` states `"JWT dual-token (15min access + 7d refresh tokens, httpOnly cookies)"` but the implementation does not use cookies.

---

#### I-02 — 60 npm Vulnerabilities (28 High, 32 Moderate)

**File**: `package.json`  
`npm audit` reports 60 total advisories: 28 High, 32 Moderate. The high-severity findings are primarily in the NX build toolchain (`@nx/*`, `@nrwl/*`) and `@nestjs/platform-express`. These do not affect runtime production code directly (build tools), but `@nestjs/platform-express` is a runtime dependency. All are fixable via major version upgrades to NX v22 and NestJS v11.

Notable runtime-affecting entries:
- `@nestjs/platform-express: <=11.1.14` (HIGH)
- `@nestjs/common: 10.4.16 - 10.4.22` (MODERATE)
- `axios: 1.0.0 - 1.14.0` (MODERATE)

**Remediation**: Run `npm audit fix` for auto-fixable items; plan NX and NestJS v11 major upgrades.

---

#### I-03 — Admin Role Always Hardcoded to `AdminRole.ADMIN`

**File**: `apps/api/src/modules/admin/commands/admin-login.handler.ts:94`  
The JWT payload always sets `role: AdminRole.ADMIN`. If `AdminRole` has multiple privilege levels (e.g. SUPER_ADMIN, MODERATOR), the current code grants every admin login the maximum role. Fine-grained role-based access within the admin subsystem is not enforced.

---

## OWASP Top 10 2021 Coverage Summary

| Category | Status | Findings |
|----------|--------|----------|
| A01 Broken Access Control | FAIL | C-02, H-05, M-02 |
| A02 Cryptographic Failures | FAIL | C-03, H-02, M-07 |
| A03 Injection | PASS | TypeORM ORM usage, parameterized queries in GDPR services |
| A04 Insecure Design | PARTIAL | M-03, M-04 |
| A05 Security Misconfiguration | FAIL | H-01, H-03, M-01 |
| A06 Vulnerable Components | FAIL | I-02 (60 npm advisories) |
| A07 Auth Failures | FAIL | C-01, H-04, M-04 |
| A08 Software/Data Integrity | PASS | Magic bytes validation present |
| A09 Logging Failures | PARTIAL | M-05, M-06 |
| A10 SSRF | PASS | No outbound user-controlled URL fetching found |

---

## GDPR Compliance Assessment

| Requirement | Status | Notes |
|-------------|--------|-------|
| Art. 17 Right to Erasure | PARTIAL | Implementation exists; consent_records table deletion present but group ownership transfer not implemented (TODO in code) |
| Art. 20 Data Portability | PARTIAL | Export service exists but data stored in memory (M-03); multi-instance unreliable |
| Art. 25 Privacy by Design | PARTIAL | No email verification (M-04); PII in audit logs (M-06) |
| Art. 32 Security of Processing | FAIL | DB SSL not configured (M-07); secrets committed to git (C-03) |
| Art. 33 Breach Notification | NOT ASSESSED | No breach detection pipeline visible in codebase |
| Consent Management | PASS | ConsentService and ConsentType enum present, CRUD endpoint implemented |

---

## Remediation Priority

| Priority | ID | Title | Effort |
|----------|----|-------|--------|
| P0 — Immediate | C-01 | Implement real TOTP 2FA | 2–3 days |
| P0 — Immediate | C-02 | Remove client-controlled adminId from 2FA flow | 4 hours |
| P0 — Immediate | C-03 | Remove credential files from git, rotate secrets | 2 hours |
| P1 — This Sprint | H-01 | Apply Helmet middleware | 30 minutes |
| P1 — This Sprint | H-02 | Require dedicated JWT_ADMIN_SECRET, no fallback | 1 hour |
| P1 — This Sprint | H-03 | Configure trust proxy; remove manual X-Forwarded-For parsing | 1 hour |
| P1 — This Sprint | H-04 | Strict throttle on admin login endpoint | 30 minutes |
| P1 — This Sprint | H-05 | Segregate admin accounts from member records | 3–5 days |
| P2 — Next Sprint | M-01 | Disable TypeORM synchronize | 1 hour |
| P2 — Next Sprint | M-02 | Restrict Socket.IO room join to allowlisted patterns | 2 hours |
| P2 — Next Sprint | M-03 | Persist GDPR export data to DB/S3 | 1 day |
| P2 — Next Sprint | M-04 | Implement email verification on registration | 1 day |
| P2 — Next Sprint | M-05 | Pass real IP to session records | 2 hours |
| P2 — Next Sprint | M-06 | Remove PII from audit log details | 1 hour |
| P2 — Next Sprint | M-07 | Configure PostgreSQL SSL | 1 hour |
| P3 — Backlog | L-01–L-05 | Low-severity hardening items | varies |
| P3 — Backlog | I-01 | Migrate to httpOnly cookie token delivery | 2–3 days |
| P3 — Backlog | I-02 | npm audit fixes and NX/NestJS major upgrades | 1–2 sprints |

---

## Positive Security Controls Observed

The following controls are correctly implemented and should be preserved:

- **bcrypt at 12 rounds** — strong password hashing in `register-member.handler.ts`.
- **JWT key rotation via Redis** — `KeyRotationService` with grace-period verification windows.
- **Token blacklisting with JTI** — `TokenBlacklistService` using Redis SCAN (not KEYS) for safe iteration.
- **Global JwtAuthGuard with `@Public()` opt-out** — secure by default, requires explicit unlocking.
- **Global ValidationPipe with `whitelist: true, forbidNonWhitelisted: true`** — prevents mass-assignment attacks.
- **Account lockout on failed logins** — `member.recordFailedLogin()` tracked in `login-member.handler.ts`.
- **Magic bytes file validation** — `validateImageBuffer()` inspects actual file signatures, not MIME type headers.
- **Parameterized queries in GDPR services** — `dataSource.query(sql, params)` pattern used throughout `data-export.service.ts` and `data-erasure.service.ts`.
- **CORS restricted to explicit origins** — `CORS_ALLOWED_ORIGINS` environment variable required.
- **Immutable audit log** — `PostgresAuditEntryRepository.save()` throws on version > 1, `delete()` always throws.
- **GDPR erasure atomicity** — `data-erasure.service.ts` uses a single transaction across all bounded contexts.
- **Rate limiting via ThrottlerModule** — 3-tier global throttle registered as `APP_GUARD`.
- **Log redaction config** — authorization, cookie, password, token, refreshToken paths are marked for redaction.

---

*Report generated by V3 QE Security Auditor — Read-only audit, no files modified except this report.*
