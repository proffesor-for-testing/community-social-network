# 06 — Active, Observable Test Ideas (Master Regression List)

**QCSD Phase:** Refinement (Sprint Commitment) — Transformation Stage
**Subject:** Admin TOTP 2FA + Session-Bound Identity + Admin-Role Provenance
**Date:** 2026-06-16
**Author:** Test Idea Rewriter (transformation stage, QCSD Refinement swarm)

## Purpose

This file is the deduplicated, prioritized **master test list** synthesized from six refinement
reports (`02-product-factors.md`, `03-bdd-scenarios.md`, `04-requirements-validation.md`,
`05-contract-validation.md`, `05-sod-analysis.md`, `05-dependency-map.md`). Every passive
"Verify/Ensure/Check that …" description has been rewritten into an **active, observable, executable
action**: each test names the **action**, the **input**, the **endpoint/unit**, and the **concrete
observable assertion** (status code, token claim, DB column state, audit row).

### The security invariant being defended

> Possession of `email + password` MUST NOT be sufficient to perform any privileged admin action.
> A second, independent factor (TOTP bound to a server-stored secret) AND a server-issued,
> identity-bound session are BOTH required — and the actor must be a *real, provisioned admin*.

### Format contract for every test below

`[ACTION] [specific input] against [endpoint/unit]; [OBSERVATION VERB] [concrete observable result].`

### Endpoint reference (as they exist today)

| Endpoint | Auth today | Handler |
|----------|-----------|---------|
| `POST /api/admin/auth/login` | `@Public()` | `AdminLoginHandler` |
| `POST /api/admin/auth/verify-2fa` | none (reads `x-admin-id`) | `Verify2faHandler` |
| `POST /api/admin/2fa/setup` | `AdminAuthGuard` | `Setup2faHandler` |
| `PUT /api/admin/users/:id/suspend`, `GET /api/admin/users`, `GET /api/admin/audit-log`, `GET /api/admin/security-alerts` | `AdminAuthGuard` | privileged actions |

---

## Group 1 — Privilege-escalation (role provenance + pre-2FA bypass)

Root defects: `admin-login` self-grants `['admin','member']` to **any active member** with no admin
store (SoD-1/PE-1); login returns `requiresTwoFactor:false` and a full admin token before any 2FA
(G1/PE-2); the guard never checks `twoFactorVerified` (G5/PE-3).

| ID | Pri | Source(s) | Active, observable test |
|----|-----|-----------|--------------------------|
| PE-01 | P0 | SoD-1, PE-1, RV/AC-7 | Register an ordinary non-admin member, then POST that member's `{email,password}` to `POST /api/admin/auth/login`; assert HTTP 401/403, assert the response body contains no `accessToken`, and decode any returned token to assert its `roles` array does NOT contain `'admin'`. |
| PE-02 | P0 | PE-1, SoD §2.2 | Decode the access token minted by `POST /api/admin/auth/login` for a non-admin member; assert `roles` excludes `'admin'` and that no `AdminRole` (SUPER_ADMIN/ADMIN/MODERATOR) grant is present without a persisted admin record. |
| PE-03 | P0 | F-2/F-5/PE-2, BDD F2 | Submit valid admin `{email,password}` to `POST /api/admin/auth/login`; assert HTTP 200, assert `requiresTwoFactor:true`, and assert the returned token carries scope `2fa-pending` with TTL ≤ 5 min (NOT a full admin token). |
| PE-04 | P0 | F-1/F-6/G1, BDD F2 regression | Take the post-login (pre-2FA) token and call `PUT /api/admin/users/:victimId/suspend`; assert HTTP 401, and re-query the victim member to assert its status is unchanged (`ACTIVE`). **This is the #1 must-pass regression.** |
| PE-05 | P0 | F-6/G5/PE-3, RV/AC-9 | Call `GET /api/admin/users` with a token whose `twoFactorVerified` claim is `false`/absent; assert `AdminAuthGuard` returns HTTP 401/403 (proves the guard reads and enforces the claim, not the hardcoded `false`). |
| PE-06 | P0 | SoD-3/4 | Call `PUT /api/admin/users/:id/suspend` with a fully verified admin token; assert HTTP 200, then read `GET /api/admin/audit-log` and assert `performedBy` equals the cryptographically-verified token `sub` and cannot be overridden by any client-supplied header. |
| PE-07 | P1 | O-3/PE-5/SoD-14 | Obtain a verified admin token, suspend/disable that admin server-side, then reuse the token on `GET /api/admin/users`; assert HTTP 401/403 (proves per-request role re-validation, not blind JWT trust). |
| PE-08 | P1 | F-5/T-1 | Drive the state machine `unauthenticated → credentials-valid(challenge) → 2FA-valid(session)` and at each non-final state call `GET /api/admin/audit-log`; assert privileged routes return 401 in every state except the final verified one. |
| PE-09 | P2 | SoD-12 | Present a MODERATOR-tier identity (once roles are persisted) to `PUT /api/admin/users/:id/suspend`; assert HTTP 403 unless an ADMIN/SUPER_ADMIN tier claim is present (proves tiered least-privilege). |

---

## Group 2 — 2FA enforcement (real TOTP verification, replay, drift, lockout)

Root defects: `verify-2fa` accepts ANY `/^\d{6}$/` code (G2/D1); no secret, no time window, no
replay protection (F-3/F-4); no throttle/lockout (G9/O-4); setup activates on any code (D4).

| ID | Pri | Source(s) | Active, observable test |
|----|-----|-----------|--------------------------|
| 2FA-01 | P0 | F-2/F-3/AC-3, BDD F4 regression | Submit code `000000` (well-formed but not the current TOTP) to `POST /api/admin/auth/verify-2fa` with a valid `2fa-pending` token for an enrolled admin; assert HTTP 401, assert no admin JWT in the response body, and assert an `ADMIN_2FA_VERIFY_FAILED` audit row is written. **Must-pass regression #2.** |
| 2FA-02 | P0 | F-3/SoD-10 | Submit twelve sequential codes `000000`…`000011` to `POST /api/admin/auth/verify-2fa` for one enrolled admin whose true code differs; assert every response is 401 and no token is ever issued (kills "any 6 digits passes"). |
| 2FA-03 | P0 | F-2, BDD F3 happy | Generate the current TOTP from the enrolled secret with `otplib.authenticator.generate(secret)` and submit it to `POST /api/admin/auth/verify-2fa` with a valid `2fa-pending` token; assert HTTP 200, assert the returned `accessToken` carries `twoFactorVerified:true` and `roles` including `'admin'`, and assert that token is accepted by `GET /api/admin/users` (HTTP 200). |
| 2FA-04 | P0 | F-4/AC-5, BDD F4 replay | Submit a TOTP code that already succeeded once, again within the same 30s step, to `POST /api/admin/auth/verify-2fa`; assert HTTP 401 with a "code already used" indication and assert no new admin token is minted (one-time-use enforcement). |
| 2FA-05 | P0 | T-2, BDD F5 concurrency | Fire two `POST /api/admin/auth/verify-2fa` requests carrying the same valid code in the same 30s step simultaneously; assert exactly one returns 200 with an admin token and the other returns 401 (one-time-use under race). |
| 2FA-06 | P1 | F-8/AC-4, BDD F5 skew | Submit codes computed at authenticator offsets `{0s, -29s, +29s}` to `POST /api/admin/auth/verify-2fa`; assert HTTP 200 for each (±1 step skew). Then submit codes at `{-60s, +60s}`; assert HTTP 401 (outside window). |
| 2FA-07 | P1 | F-9, dep-map T1 | Compute HOTP/TOTP for RFC 6238 vectors (secret `12345678901234567890`, T=59 → `94287082`, T=1111111109 → `07081804`) against `otplib`; assert byte-exact match (proves a real algorithm, not a stub). |
| 2FA-08 | P1 | O-4/G9/R8, BDD F4 lockout | Submit invalid codes to `POST /api/admin/auth/verify-2fa` in rapid succession; assert the 5th attempt returns HTTP 429 with "2FA locked", and assert an `ADMIN_2FA_BRUTE_FORCE` (or equivalent) audit alert is written. **Must-pass regression #5.** |
| 2FA-09 | P1 | F-7/D-2/AC-10 | Submit malformed codes `{abc12, 12345, 1234567, "", "12 34 56"}` to `POST /api/admin/auth/verify-2fa`; assert HTTP 400/422 at the validation layer (not a deep-handler 401), assert no token is issued, and assert the audit reason distinguishes "invalid format" from "incorrect code". |
| 2FA-10 | P0 | BDD F1, D4 | Submit `{code:"123456"}` to `POST /api/admin/2fa/setup` when NO secret has been generated for the admin; assert HTTP 400/409, assert the response indicates no enrollment in progress, and query storage to assert the admin's 2FA status remains `NONE` (kills "returns enabled:true for any code"). |
| 2FA-11 | P0 | BDD F1, AC-2 | With a `PENDING_CONFIRMATION` secret, submit a wrong code `000000` to `POST /api/admin/2fa/setup`; assert HTTP 401 and query storage to assert 2FA status stays `PENDING_CONFIRMATION` (never `ACTIVE`). Then submit the correct generated code; assert HTTP 200 and status becomes `ACTIVE`. |
| 2FA-12 | P1 | F-12/O-3 | Submit the correct current TOTP for a SUSPENDED/deleted admin to `POST /api/admin/auth/verify-2fa`; assert HTTP 401/403 even with a valid code (admin existence + ACTIVE status re-checked at verify time). |
| 2FA-13 | P2 | F-10, O-1, BDD F1 | Walk the full enrollment ceremony (authenticated admin → `POST /api/admin/2fa/setup` → receive `otpauthUri` → confirm with a real code → activate), then attempt login + privileged route without presenting a code; assert privileged access returns 401 (enrollment cannot be skipped, login-only cannot pass). |

---

## Group 3 — Token contract (single signing authority, claim shape, session binding)

Root defects: `verify-2fa` signs via `JwtService`/`JWT_SECRET`, fails `AdminAuthGuard`/
`JwtTokenService` on four checks — wrong secret, missing `iss=csn-api`/`aud=csn-web`, missing `jti`,
`role:'admin'` string vs required `roles:string[]` (G3/contract §2). Identity is read from the
client `x-admin-id` header (G4/PE-4/contract §3); `/verify-2fa` is neither `@Public()` nor guarded.

| ID | Pri | Source(s) | Active, observable test |
|----|-----|-----------|--------------------------|
| TOK-01 | P0 | contract §5.1, S-2 | Mint a token via the real `Verify2faHandler`, then pass it to a real `AdminAuthGuard.canActivate`; assert it returns `true` with `sub/email/roles` populated (today this FAILS — it is the proof of the broken token contract). |
| TOK-02 | P0 | contract §5.4 | Decode the token minted by `POST /api/admin/auth/verify-2fa`; assert it contains `roles:string[]` including `'admin'`, a `jti` claim, `iss=csn-api`, and `aud=csn-web` — structurally identical to `JwtTokenService.generateAccessToken` output (catches drift back to `{role,type}`). |
| TOK-03 | P0 | I-1/I-2/G4/PE-4, BDD F4, SoD-8 | POST `POST /api/admin/auth/verify-2fa` with header `x-admin-id:<realAdminId>`, NO valid `2fa-pending` token, and `{code:"000000"}`; assert HTTP 401 and assert NO admin token is minted for `<realAdminId>` (today this wrongly mints a 15m admin token — the privilege-escalation core). **Must-pass regression #3.** |
| TOK-04 | P0 | I-1/AC-6 | POST `POST /api/admin/auth/verify-2fa` carrying ONLY a body `code` and a valid `2fa-pending` token, plus a *conflicting* `x-admin-id` header; assert identity is derived from the token `sub` and the `x-admin-id` header is disregarded (assert minted token `sub` == challenge-token subject). |
| TOK-05 | P0 | I-3/T-5/SoD-9, BDD F4 swap | Hold a `2fa-pending` token bound to admin B and submit the current valid TOTP code for admin A to `POST /api/admin/auth/verify-2fa`; assert HTTP 401 and assert no admin token is issued for admin B (cross-identity confusion blocked). |
| TOK-06 | P1 | BDD F4, AC-8 | Use a `2fa-pending` token that already completed one verification to call `POST /api/admin/auth/verify-2fa` again; assert HTTP 401 (pre-2FA token is single-use and now invalid). |
| TOK-07 | P1 | I-2/BDD F4 | Call `POST /api/admin/auth/verify-2fa` with no token AND no `x-admin-id` header and `{code:"123456"}`; assert HTTP 401 (no 500 from `UserId.create(undefined)`), and assert no token is issued. |
| TOK-08 | P1 | T-7/BDD F5 | Issue a `2fa-pending` token, wait past its ≤5-min TTL, then submit a currently-valid code to `POST /api/admin/auth/verify-2fa`; assert HTTP 401 with "session expired" and force re-login. |
| TOK-09 | P1 | BDD F2 | Take the `2fa-pending` token from `POST /api/admin/auth/login` and call `GET /api/admin/audit-log`; assert HTTP 401 (pre-2FA token rejected on privileged routes). |
| TOK-10 | P2 | contract §5.9/10 | POST valid creds to `POST /api/admin/auth/login`; assert the body is exactly `{accessToken, requiresTwoFactor, adminId(uuid)}` with no leaked fields (no password hash, no member internals). Then POST invalid creds; assert HTTP 401 and assert the body contains no `accessToken` key. |
| TOK-11 | P2 | I-5/contract §5.7 | Fuzz the `verify-2fa` body with `{}`, `{code:null}`, `{code:[1,2,3,4,5,6]}`, a nested object, and a 1MB payload; assert HTTP 400 with class-validator messages and zero HTTP 500 responses. |

---

## Group 4 — TOTP / secret data (encryption-at-rest, no leakage, lifecycle)

Root defects: no secret persistence exists (G6); secret must be encrypted at rest (D-1/R2) and never
echoed (D-6); DTO admits non-digits while handler requires `^\d{6}$` (G12/D-2).

| ID | Pri | Source(s) | Active, observable test |
|----|-----|-----------|--------------------------|
| DAT-01 | P0 | D-1/AC-1, dep-map T2 | Enroll 2FA via `POST /api/admin/2fa/setup`, then read the raw `admin_totp_secrets` DB column; assert the stored value is ciphertext (not plaintext base32), decrypt it and assert it equals the original secret, and assert no enrollment/verify/setup API response body ever returns the plaintext secret. |
| DAT-02 | P0 | S-9/R2/R3, dep-map T3 | Boot the module with `TOTP_ENCRYPTION_KEY` unset/short/weak; assert startup FAILS loudly rather than storing secrets unencrypted or under a default key (mirrors the `admin-jwt-secret-change-me` anti-pattern). |
| DAT-03 | P0 | S-4/G7 | Boot the module with `JWT_SECRET` unset; assert startup FAILS rather than silently using `'admin-jwt-secret-change-me'`. |
| DAT-04 | P1 | D-2/G12/contract §5.7, BDD boundary | Submit `code` with leading/trailing whitespace, Arabic-Indic digits (`٦٥٤٣٢١`), `+6` notation, and length 5/7 to `POST /api/admin/auth/verify-2fa`; assert HTTP 400/422 (strict ASCII `^\d{6}$`) and assert the DTO `@Length(6,6)` is tightened to `@Matches(/^\d{6}$/)` so DTO and handler agree. |
| DAT-05 | P1 | D-5 | Re-run `POST /api/admin/2fa/setup` for an admin who already has an ACTIVE secret; assert the existing secret is NOT silently overwritten without fresh re-authentication (prevents secret-reset attack). |
| DAT-06 | P2 | D-6 | Trigger login, verify, and setup failures, then inspect every response body and audit `details` JSON; assert no secret, QR seed, or full TOTP code appears in any log, error stack, or Swagger example. |
| DAT-07 | P1 | P-1, dep-map | Drop the secret-store (DB) connection during `POST /api/admin/auth/verify-2fa`; assert the endpoint fails CLOSED (HTTP 401/503, access denied), never fail-open to "accept any code". |
| DAT-08 | P2 | D-7 | Parse the `otpauthUri` returned by enrollment; assert it matches `otpauth://totp/CSN:<email>?secret=...&issuer=CSN` and is consumable by a standard authenticator (round-trip generate → verify). |
| DAT-09 | P2 | S-1/S-8/S-11, dep-map | Inspect the lockfile and import graph; assert `otplib@^12` is pinned, assert no `otplib`/`crypto` import leaks into `libs/domain/admin` (DDD purity), and assert the nx module-boundary lint blocks such imports. |

---

## Group 5 — Operations / throttling (re-validation, recovery, time, concurrency, ops)

| ID | Pri | Source(s) | Active, observable test |
|----|-----|-----------|--------------------------|
| OPS-01 | P1 | O-5 | Enumerate `suspend-user`, `unsuspend-user`, `get-audit-log`, `get-security-alerts` and call each with a token lacking `twoFactorVerified:true`; assert every one returns 401 (all privileged ops sit behind 2FA enforcement, not bare `AdminAuthGuard`). |
| OPS-02 | P1 | O-3/T-4 | Let a 15-min admin session expire, then call `PUT /api/admin/users/:id/suspend`; assert HTTP 401 forcing re-authentication + re-2FA (no silent token renewal). |
| OPS-03 | P1 | P-3 | Run TOTP verification under `TZ=Asia/Kolkata` and `TZ=America/Sao_Paulo`; submit the UTC-correct code and assert HTTP 200 (TOTP is UTC-epoch based, must be timezone-immune). |
| OPS-04 | P1 | P-2/T-3 | Set the server clock +90s ahead of the authenticator and submit the authenticator's code to `POST /api/admin/auth/verify-2fa`; assert acceptance only within the configured skew window and 401 beyond it; submit at step boundaries T∈{29.9s, 30.1s} and assert deterministic accept/reject with no double-validity overlap. |
| OPS-05 | P1 | T-5 | Run two admins enrolling/verifying concurrently; submit admin A's code while resolving admin B's session and assert A's code never validates against B's secret (no cross-contamination). |
| OPS-06 | P2 | O-2 | Attempt admin access as an admin who lost their authenticator (no recovery codes) and exercise the recovery path; assert a defined, audited recovery flow exists that itself requires strong re-verification — or document the gap if absent. |
| OPS-07 | P2 | O-6 | Call the "disable 2FA" operation for an admin; assert it requires a fresh 2FA challenge and writes an audit row (a single compromised session cannot silently remove the factor). |
| OPS-08 | P2 | O-7 | Drive an admin logging in daily across consecutive 30s windows with rotating codes; assert zero false rejections at window boundaries (happy-path stability). |
| OPS-09 | P2 | P-5/P-6 | Profile the secret-store read on the verify path under 500ms induced latency; assert each verify is a single bounded lookup (no N+1/full-scan DoS) and that p95 stays within SLO while timing out fail-closed. |
| OPS-10 | P3 | dep-map T9/R1 | Add `otplib` and run install + `nx build api`/`build:web` in CI; assert the 15 `overrides` (esp. `esbuild`/`rollup`/`multer`) still resolve and the first-start build is not broken; flag the bogus `lodash ^4.18.1` override. |
| OPS-11 | P3 | dep-map T10/R7 | Apply the `admin_totp_secrets` migration on a clean DB; assert the table and columns exist with a unique constraint on admin id. |

---

## The 5 must-pass regression tests (proof the bypass is closed)

These five, all green simultaneously, are the minimal proof that "credentials alone are NOT sufficient":

1. **PE-04 — Pre-2FA token cannot perform a privileged action.** Login token used on `PUT /api/admin/users/:victimId/suspend` → assert HTTP 401 and victim status unchanged. *(Closes G1: login already mints a full admin token.)*
2. **2FA-01 — A wrong well-formed code is rejected.** `{code:"000000"}` to `POST /api/admin/auth/verify-2fa` for an enrolled admin → assert HTTP 401, no admin JWT in body, `ADMIN_2FA_VERIFY_FAILED` audited. *(Closes G2: any 6 digits passes.)*
3. **TOK-03 — Forged `x-admin-id` mints no token.** `x-admin-id:<realAdminId>` + no challenge token + `{code:"000000"}` → assert HTTP 401, no token minted for `<realAdminId>`. *(Closes G4/PE-4: client-supplied identity + any-code = full privilege escalation with NO credentials.)*
4. **PE-01 — A non-admin member cannot self-grant admin.** Ordinary member's `{email,password}` to `POST /api/admin/auth/login` → assert 401/403 and decoded token has no `'admin'` role. *(Closes SoD-1/PE-1: knowing any member's password ≠ being admin.)*
5. **2FA-08 — Brute-force lockout engages.** Rapid invalid codes to `POST /api/admin/auth/verify-2fa` → assert HTTP 429 on the 5th attempt with a brute-force audit alert. *(Closes G9: 6-digit space is otherwise brute-forceable in the 30s window.)*

> Supporting guard for #1: **PE-05** (`twoFactorVerified` enforced at the guard) and **2FA-03** (a correct code *does* mint a working, guard-accepted admin token) must also pass, otherwise #1 could pass trivially by breaking all admin access.

---

## Summary

| Group | Count | P0 | P1 | P2 | P3 |
|-------|-------|----|----|----|----|
| 1 — Privilege-escalation | 9 | 6 | 2 | 1 | 0 |
| 2 — 2FA enforcement | 13 | 7 | 5 | 1 | 0 |
| 3 — Token contract | 11 | 5 | 4 | 2 | 0 |
| 4 — TOTP / secret data | 9 | 3 | 3 | 3 | 0 |
| 5 — Operations / throttling | 11 | 0 | 5 | 4 | 2 |
| **Total** | **53** | **21** | **19** | **11** | **2** |

- **Total test ideas rewritten:** 53 (deduplicated from 58 SFDIPOT + ~40 BDD + 10 requirements AC + 10 contract + 14 SoD + 10 dependency ideas; overlapping ideas merged with source cross-references).
- **Passive phrasing eliminated:** every "Verify/Ensure/Check that …" rewritten to `[ACTION] … against [endpoint/unit]; [OBSERVATION] [observable result]`. Zero passive `Verify`-style test descriptions remain.
- **Highest concentration of P0:** Groups 1–3 (privilege-escalation, 2FA enforcement, token contract) — the seam where the inverted security invariant actually lives.
