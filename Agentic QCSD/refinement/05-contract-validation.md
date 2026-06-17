# 05 — API Contract Validation: Admin Auth & TOTP 2FA

**Agent:** API Contract Validator (QCSD Refinement Swarm, HAS_API=TRUE)
**Subject:** Admin authentication & TOTP 2FA flow
**Date:** 2026-06-16
**Scope:** `apps/api/src/modules/admin/**` + read-only confirmation of `libs/infrastructure/auth/src/jwt.service.ts` / `jwt.config.ts`. Identity/auth files outside the admin module were read but NOT edited (owned by another dev).

---

## Endpoints Under Validation

| Method | Path | Auth | Handler | Token role |
|--------|------|------|---------|------------|
| POST | `/api/admin/auth/login` | `@Public()` | `AdminLoginHandler` | **mints** canonical token (`JwtTokenService`) |
| POST | `/api/admin/auth/verify-2fa` | none decorator; not behind guard | `Verify2faHandler` | **mints** non-canonical token (`JwtService`) |
| GET/PUT/POST | `/api/admin/*` | `AdminAuthGuard` | various | **verifies** canonical token (`JwtTokenService`) |

---

## 1. Request / Response Schema Contracts

### Request DTOs

| DTO | Field | Validation | Required? | Notes |
|-----|-------|-----------|-----------|-------|
| `AdminLoginDto` | `email` | `@IsEmail` | yes | OK |
| | `password` | `@IsString @MinLength(1)` | yes | `MinLength(1)` is effectively "non-empty" only — fine for login (no policy leak), but Swagger advertises a strong example that the contract does not enforce. |
| `Verify2faDto` | `code` | `@IsString @Length(6,6)` | yes | Enforces 6 chars but **not digits**. `"abcdef"` passes DTO validation; only the handler's `/^\d{6}$/` regex rejects it. Contract (DTO) and implementation disagree on the character set. |
| `Setup2faDto` | `code` | `@IsString @Length(6,6)` | yes | Same digit gap as above. |
| `SuspendUserDto` | `reason` | `@IsString @MinLength(10) @MaxLength(1000)` | yes | Well-specified. |
| `AuditLogQueryDto` | `page/limit/action/actorId/startDate/endDate` | typed + bounded | all optional | Good; `limit` capped at 100. |

### Response contracts

- **`POST /login`** returns `AdminLoginResult` = `{ accessToken, requiresTwoFactor, adminId }`. **No response DTO / `@ApiResponse` schema** is declared — Swagger only documents status codes, not the body shape. Consumers (admin web app) have no published contract for the response body.
- **`POST /verify-2fa`** returns `Verify2faResult` = `{ accessToken, adminId }`. Again **no response schema** in Swagger. Note the body shape differs from login (`requiresTwoFactor` absent), so a consumer cannot treat the two token-issuing endpoints uniformly.
- **`AdminUserResponseDto` / `AuditLogResponseDto` / `SecurityAlertResponseDto`** exist and are well-decorated, but are **not wired to any controller method via `@ApiResponse({ type })`** — they document a schema nobody is contractually bound to return. The actual query handlers' return shapes are undocumented in the contract.

**Severity — schema documentation gaps:** MEDIUM. The endpoints work, but there is no machine-readable response contract for any admin endpoint, so consumer-driven contract tests cannot be generated from Swagger alone.

---

## 2. Token Contract: Issuer vs Verifier — **CONFIRMED BROKEN**

A token minted by `POST /verify-2fa` **cannot** be accepted by `AdminAuthGuard`. This is not a single defect — it is broken at **three independent layers**, any one of which is fatal.

### Issuer side — `verify-2fa.handler.ts:63-70`
```ts
const payload = { sub: command.adminId, role: AdminRole.ADMIN, type: 'admin', twoFactorVerified: true };
const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
```
Signed by `@nestjs/jwt` `JwtService` configured in `admin.module.ts:32-35`:
- secret = `process.env.JWT_SECRET ?? 'admin-jwt-secret-change-me'`
- **no `issuer`, no `audience`, no `jti`**

### Verifier side — `admin-auth.guard.ts:32,37` → `JwtTokenService.verifyAccessToken`
```ts
payload = await this.jwtTokenService.verifyAccessToken(token);     // guard
...
if (!Array.isArray(payload.roles) || !payload.roles.includes('admin')) { ... }  // role check
```
`verifyAccessToken` (`jwt.service.ts:141-180`) requires:
- secret = key-rotation key derived from `JWT_ACCESS_SECRET` (default `dev-access-secret-do-not-use-in-production`)
- `issuer: 'csn-api'` AND `audience: 'csn-web'` (from `jwt.config.ts`)
- a `jti` claim (rejects with *"Access token missing jti claim"* otherwise)
- `roles: string[]` containing `'admin'`

### Three-layer mismatch

| Layer | verify-2fa token | guard expects | Result |
|-------|------------------|---------------|--------|
| **Signing secret** | `JWT_SECRET` / `admin-jwt-secret-change-me` | `JWT_ACCESS_SECRET` / rotated key | Signature verify fails first |
| **issuer / audience** | none set | `iss=csn-api`, `aud=csn-web` required | Rejected even if secrets matched |
| **`jti` claim** | absent | required (`:163-165`) | Rejected even if iss/aud matched |
| **Role claim shape** | `role: 'admin'` (singular string) + `type: 'admin'` | `roles: ['admin', ...]` (array) | `payload.roles.includes` would throw/fail even if token verified |

**Verdict:** The issuer/verifier token contract is **DEFINITIVELY BROKEN**. The verify-2fa token fails at the very first check (wrong secret) and would still fail at three subsequent checks. **Severity: CRITICAL.** Functionally, completing 2FA produces a token that grants access to **zero** admin routes — the 2FA endpoint is dead-ended.

**Contrast:** `AdminLoginHandler:92-96` already does it correctly — it mints via `JwtTokenService.generateAccessToken({ userId, email, roles: ['admin','member'] })`, which produces a token the guard accepts. So `/login` already issues a guard-valid admin token; `/verify-2fa` re-issues an incompatible one. This means the canonical fix is to make verify-2fa mint through `JwtTokenService` exactly as login does (and inject `email`/`roles`, which it currently lacks).

---

## 3. Identity-in-Header Anti-Pattern — **CONFIRMED**

`admin-auth.controller.ts:49-59`:
```ts
async verify2fa(@Body() dto: Verify2faDto, @Req() req: Request) {
  const adminId = req.headers['x-admin-id'] as string;   // caller-asserted identity
  ...
  const result = await this.verify2faHandler.execute({ adminId, code: dto.code, ipAddress });
}
```

The endpoint accepts the identity to authenticate **from a client-supplied header**. The contract therefore lets any caller assert *who they are* during the second factor of authentication. Consequences:

- **Auth bypass of the 2FA binding:** an attacker who knows/guesses a victim `adminId` (UUIDs surface in audit logs, `AuditLogResponseDto.performedBy`, and `actorId` query filters) can submit any 6-digit code (handler only checks `/^\d{6}$/`, TODO admits "accept any valid 6-digit code") and get a token minted *for that admin's id*. The TOTP is not bound to a verified session.
- **Contract leaks/relies on internal identity:** `x-admin-id` is an undocumented header (no `@ApiHeader`), so it is both a hidden contract and an injection point.
- **No `@Public()` but also not behind `AdminAuthGuard`:** verify-2fa sits in an undefined auth state — it is neither explicitly public nor guarded, while sibling `/login` is `@Public()`.

**Severity: CRITICAL (security) / HIGH (contract).** The contract must never accept caller-asserted identity. Identity for verify-2fa must come from a server-issued artifact created at `/login` — a short-lived **pre-2FA challenge token** (signed, single-use, carrying `sub`) presented as a `Bearer` token, or an opaque server-side session id. The handler already returns `adminId` from login, so login is the correct place to mint that challenge.

---

## 4. Backward-Compatibility / Breaking-Change Analysis

The proposed fixes change observable contract surface. Classification:

| Change | Breaking? | Affected consumer | Migration |
|--------|-----------|-------------------|-----------|
| Remove `x-admin-id` header; require pre-2FA challenge token instead | **YES** | Admin web client calling `/verify-2fa` | Login response must return the challenge token; client must send it as `Authorization: Bearer` (or a named field) instead of `x-admin-id`. Coordinate client + API release. |
| Unify verify-2fa token issuance onto `JwtTokenService` | **NO (net positive)** | Admin routes / `AdminAuthGuard` | The *current* token is rejected anyway, so no working consumer depends on the old format. Switching to the canonical token only *adds* working access. Strictly a bug-fix, not a break. |
| verify-2fa needs `email` + `roles` to call `generateAccessToken` | internal | `Verify2faCommand` | Command/handler must carry `email` and `roles` (or re-load the member). Pure internal contract change. |
| Add response DTOs (`@ApiResponse({ type })`) for login/verify-2fa | **NO** (additive) | doc consumers | Additive; document existing `{ accessToken, adminId, requiresTwoFactor? }`. Keep field names stable. |
| Tighten `Verify2faDto.code` to `@Matches(/^\d{6}$/)` | low-risk | clients sending non-numeric codes | Those requests already fail in the handler today (just with a different error path), so legit clients are unaffected. |

**Version guidance:** The header removal is a **breaking change to the verify-2fa request contract → MAJOR bump** for the admin-auth API surface. Recommended sequence to stay backward-compatible during rollout:
1. (Additive) `/login` starts returning a `challengeToken` field — non-breaking.
2. `/verify-2fa` accepts **either** `x-admin-id` (deprecated) **or** the challenge token for one release; log a deprecation audit event when the header path is used.
3. Remove `x-admin-id` acceptance in the next major. Never run step 3 before the client ships step 2 usage.

The **token-unification fix should ship immediately and unconditionally** — it has no compatible consumers to break and currently leaves 2FA non-functional.

---

## 5. Concrete, Observable Contract Test Ideas

Consumer-driven / provider-verification tests, each with an observable assertion:

### Token contract (CRITICAL — these are the regression guards)
1. **Cross-service token acceptance:** Mint a token via the real `Verify2faHandler`, then feed it to a real `AdminAuthGuard.canActivate`. **Assert `true`** (id/email/roles populated). *Today this test FAILS — that is the proof of the broken contract; it must pass after the fix.*
2. **Issuer/verifier round-trip on `/login`:** POST `/login` (valid creds) → take `accessToken` → call `GET /api/admin/users` with `Authorization: Bearer <token>` → **assert HTTP 200** (not 401). Locks in that login already issues a guard-valid token.
3. **End-to-end 2FA → protected route:** `/login` → `/verify-2fa` (with whatever the fixed identity mechanism is) → use returned `accessToken` on `GET /api/admin/audit-log` → **assert 200**. This is the missing happy-path contract.
4. **Claim-shape contract:** Decode the verify-2fa token and **assert it contains `roles: string[]` including `'admin'`, plus `jti`, `iss=csn-api`, `aud=csn-web`** — i.e. structurally identical to `JwtTokenService.generateAccessToken` output. Catches any drift back to the `{ role, type }` shape.

### Identity-in-header anti-pattern
5. **Caller-asserted identity is rejected:** Call `/verify-2fa` with a forged `x-admin-id` header for an admin the caller never logged in as, and **no valid challenge token** → **assert 401** and **assert NO token is returned**. (Today this wrongly returns a token → failing test = the vulnerability.)
6. **Challenge binding:** A challenge token issued for admin A must not validate a 2FA attempt that resolves to admin B → **assert 401**.

### Request schema contracts
7. **`code` digit contract:** POST `/verify-2fa` with `{ "code": "abcdef" }` → **assert 400/422 at the validation layer** (not a 401 from deep in the handler). Forces DTO and implementation to agree on the digit constraint.
8. **Boundary:** `code` of length 5 and 7 → **assert 400**; length 6 numeric → passes validation. `SuspendUserDto.reason` at 9 vs 10 chars → 400 vs accepted.

### Response schema contracts
9. **Login response shape:** **assert** body is exactly `{ accessToken: string, requiresTwoFactor: boolean, adminId: string(uuid) }` — no extra leaked fields (e.g. no password hash, no member internals).
10. **No-token-on-failure:** invalid credentials → **assert 401 AND body contains no `accessToken` key.**

---

## Summary of Contract Violations

| # | Violation | Severity |
|---|-----------|----------|
| 1 | verify-2fa token (JwtService) incompatible with AdminAuthGuard (JwtTokenService): wrong secret, no iss/aud, no jti, `role` string vs `roles` array | **CRITICAL** |
| 2 | `/verify-2fa` reads identity from client `x-admin-id` header (caller-asserted identity) + accepts any 6-digit code | **CRITICAL** |
| 3 | `/verify-2fa` neither `@Public()` nor behind a guard — undefined auth state | HIGH |
| 4 | No response schema (`@ApiResponse({ type })`) on any admin endpoint; response DTOs exist but are unwired | MEDIUM |
| 5 | `Verify2faDto`/`Setup2faDto` `code` enforces length-6 but not digits; DTO disagrees with handler regex | LOW–MEDIUM |
| 6 | `x-admin-id` is an undocumented (no `@ApiHeader`) hidden contract | LOW |
