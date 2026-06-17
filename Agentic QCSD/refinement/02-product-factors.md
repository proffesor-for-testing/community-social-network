# SFDIPOT Product Factors Analysis — Admin 2FA + Session-Bound Identity

**QCSD Phase:** Refinement (Sprint Commitment)
**Framework:** James Bach HTSM — Product Factors (SFDIPOT)
**Date:** 2026-06-16
**Analyst:** SFDIPOT Product Factors Assessor

## Refinement Subject

> As a platform operator, admin login must require real TOTP-based 2FA and bind admin identity to a server-issued session, so that obtaining admin credentials alone is NOT sufficient to gain admin access.

**Acceptance intent (the security invariant):** Possession of `email + password` MUST NOT be sufficient to perform any privileged admin action. A second, independent factor (TOTP bound to a server-stored secret) AND a server-issued, identity-bound session are both required.

---

## Ground-Truth Code State (verified today)

Every factor below is anchored to real code in `apps/api/src/modules/admin/`. The verified state is **worse than the story brief implied** — the security invariant is currently inverted: credentials alone grant *full* admin access, and the 2FA flow is decorative.

| # | Observation | Location |
|---|---|---|
| G1 | **Login already mints a fully-privileged canonical admin token** (`roles: ['admin','member']`) and returns `requiresTwoFactor: false`. 2FA is never gated. | `commands/admin-login.handler.ts:92-100` |
| G2 | **`verify-2fa` accepts ANY 6-digit code.** No secret generated, stored, or verified. | `commands/verify-2fa.handler.ts:39,52` |
| G3 | **Two incompatible token systems.** Login uses canonical `JwtTokenService`; `verify-2fa` signs its own JWT via `JwtModule` (`JwtService`). The `AdminAuthGuard` verifies only via `JwtTokenService`, so the 2FA-issued token would be **rejected** by every protected route — it is functionally useless yet still issued. | `verify-2fa.handler.ts:32,70` vs `guards/admin-auth.guard.ts:32`; secret in `admin.module.ts:32-35` |
| G4 | **`adminId` read from client-supplied `x-admin-id` header** in the login-flow 2FA endpoint — no session binding, no server-side correlation to who logged in. | `controllers/admin-auth.controller.ts:50-52` |
| G5 | **`twoFactorVerified` hardcoded `false`** on every authenticated admin request and never enforced anywhere. | `guards/admin-auth.guard.ts:45-46` |
| G6 | **No 2FA secret persistence exists** — no entity, table, repository token, or migration. `Setup2faHandler` stores nothing (audit-only). | `commands/setup-2fa.handler.ts:34-55` |
| G7 | **Hardcoded JWT fallback secret** `'admin-jwt-secret-change-me'`. | `admin.module.ts:33` |
| G8 | **`memberRepository` injected into `Verify2faHandler` but never used** — adminId is never validated against a real/active admin member. | `verify-2fa.handler.ts:28-29` |
| G9 | **No rate limiting / lockout** on `login` or `verify-2fa`. 6-digit TOTP space is brute-forceable; no throttle guard present. | `controllers/admin-auth.controller.ts` (no `@Throttle`/guard) |
| G10 | **`Setup2faHandler` not session-aware** and trusts `adminUser.id` from the canonical token only — but setup precedes any 2FA, so the chicken-and-egg enrollment flow is undefined. | `controllers/admin.controller.ts:139-156` |

**Concurrency note:** another developer is editing identity/auth files. This analysis deliberately scopes test ideas to the **stable admin module** (`controllers/`, `commands/`, `queries/`, `guards/`). Cross-cutting `JwtTokenService` internals are treated as a black-box collaborator, not a unit-under-test.

### Cross-Validation from Peer Refinement Agents

Two independent peer agents in this refinement swarm converged on the same critical defects, raising confidence to near-certainty. Their additive findings are folded into the factors below.

**Peer A — Contract Validation (`05-contract-validation.md`):**

- **G3+ (token break is 4 layers deep):** the verify-2fa token fails `AdminAuthGuard`/`JwtTokenService.verifyAccessToken` on *four* independent checks — wrong secret (`JWT_ACCESS_SECRET` vs `JWT_SECRET`), missing `issuer=csn-api`/`audience=csn-web`, missing `jti`, and payload shape (`role: 'admin'` singular string vs required `roles: string[]`). Net effect: completing 2FA opens **zero** admin routes. Sharpens **S-2 / F-6**.
- **G11 (undefined auth state):** `/verify-2fa` is neither `@Public()` nor behind a guard, unlike its `@Public()` sibling `/login` — an undefined authentication state. Sharpens **I-2**.
- **G12 (DTO ⇄ handler contract gap):** `Verify2faDto`/`Setup2faDto` enforce `@Length(6,6)` but NOT digits, while handlers enforce `^\d{6}$`. The DTO admits `abcdef`; the handler rejects it — a contract disagreement. Sharpens **D-2 / F-7**.
- **Migration framing:** unifying the token signer is a **pure bug-fix with no backward-compat break** (the current 2FA token works for no one), but removing `x-admin-id` is a **breaking request-contract change** (MAJOR bump, client coordination required). Decision-relevant for sprint sequencing.

**Peer B — Segregation of Duties (`05-sod-analysis.md`):** found 5 privilege-escalation paths and exposed a root defect *deeper* than the 2FA story scope:

- **PE-1 / SoD-1 (CRITICAL, new root cause):** `admin-login.handler.ts` authenticates **any active member** and self-grants the `admin` role in the same request — no admin store, no allow-list, no separate control. The `AdminRole` domain enum (SUPER_ADMIN/ADMIN/MODERATOR) is **never persisted on `Member` and never consulted by the guard** (which checks only the disconnected lowercase string `'admin'`). Net effect: *knowing any active member's password = being a platform admin.* This means even a perfect 2FA implementation gates the *wrong* set of people — **2FA on top of broken role provenance still lets every member become admin.** This is a prerequisite defect the story must acknowledge; it elevates a new factor: **Function / Security — authorization provenance.**
- PE-2/PE-3/PE-4/PE-5 independently confirm my G1, G5, G4, and O-3 respectively.

> **Refinement implication:** the story as written ("credentials alone NOT sufficient") is necessary but **not sufficient** — it must be paired with real admin-role provenance (SoD-1), or 2FA merely adds a second factor on top of a door that opens for everyone.

---

## SFDIPOT Analysis

Legend — Priority: P0 critical (security/data loss) · P1 high · P2 medium · P3 low.
Automation fitness: Unit · Integration · E2E · Human (exploratory).

### S — Structure (what the product IS)

The 2FA capability is structurally hollow: handlers exist but the supporting persistence layer, secret value object, and TOTP library do not.

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| S-1 | P0 | Dependencies | Inspect the dependency graph for a TOTP library (otplib/speakeasy); assert one is present and pinned before the story can be "done" (currently absent → 2FA cannot be real). | Unit |
| S-2 | P0 | Executable Files | Trace `verify-2fa.handler` token minting and assert it calls the canonical `JwtTokenService`, not the parallel `JwtService` from `JwtModule`; fail the build if two signing paths coexist. | Integration |
| S-3 | P1 | Code Integrity | Grep the admin module for `TODO`/placeholder markers in security paths; block merge if `verify-2fa.handler` or `setup-2fa.handler` still contains "accept any" logic. | Unit |
| S-4 | P1 | Non-Executable Files | Boot the module with `JWT_SECRET` unset; assert startup FAILS rather than silently using `'admin-jwt-secret-change-me'`. | Integration |
| S-5 | P1 | Dependencies | Remove `memberRepository` from `Verify2faHandler` OR assert it is actually consulted; flag the unused injection as dead structure masking a missing admin-existence check. | Unit |
| S-6 | P2 | Executable Files | Map every provider in `admin.module.ts` to a consumer; confirm no orphaned `JwtModule.register` once canonical signing is adopted. | Human |
| S-7 | P2 | Hardware | Confirm TOTP secret generation draws from a CSPRNG (crypto.randomBytes), not Math.random; inspect the secret-generation call site. | Unit |
| S-8 | P1 | Dependencies | Assert the chosen TOTP lib is `otplib@^12` (actively maintained, RFC 6238, TS types, **no native build**) and NOT `speakeasy` (unmaintained since ~2017); pin it in the lockfile. | Unit |
| S-9 | P1 | Non-Executable Files | Boot with `TOTP_ENCRYPTION_KEY` unset/short/weak; assert startup FAILS rather than storing secrets unencrypted or under a default key (mirrors the `admin-jwt-secret-change-me` anti-pattern). | Integration |
| S-10 | P2 | Dependencies | Build the Docker image first-start with `otplib` added; assert no native-build regression (the prior first-start build issue must not recur — `otplib` is pure-JS, so this should hold). | Integration |
| S-11 | P2 | Dependencies | Assert no `otplib`/`crypto` import leaks into the `libs/domain/admin` layer (DDD purity — the `TotpSecret` VO must stay framework-free; encryption lives in infra). | Unit |
| S-12 | P3 | Dependencies | Audit `package.json` `overrides` (lines 88-105, 15 pinned transitive resolutions): assert the TOTP PR does not collide with them, and flag the broken `lodash ^4.18.1` (non-existent; should be `^4.17.21`). | Human |

> **Dependency facts confirmed by peer (`05-dependency-map.md`):** no TOTP lib is installed today. Encryption needs **no new npm dep** — Node stdlib `crypto` AES-256-GCM suffices. 6 modules impacted across 3 DDD layers; circular-dependency risk is LOW (admin/identity libs are acyclic). New config required: `TOTP_ENCRYPTION_KEY` + a DB migration for the encrypted secret store.

### F — Function (what the product DOES)

This is the heart of the story. The function currently does the opposite of its intent.

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| F-1 | P0 | Security | Submit valid email+password to `/login`; assert the response grants NO privileged access (`requiresTwoFactor: true`, and any returned token is a short-lived *pre-2FA challenge* token that `AdminAuthGuard` rejects for privileged routes). | Integration |
| F-2 | P0 | Security | Generate a TOTP from the enrolled secret using a real authenticator algorithm; submit it; confirm access granted. Then submit a wrong-but-well-formed code (`000000`); confirm access denied. | Integration |
| F-3 | P0 | Security | Submit code `123456` repeatedly against an account whose true code differs; assert every attempt is rejected (kills the current "any 6 digits passes" defect G2). | Unit |
| F-4 | P0 | Security | Replay a previously-accepted TOTP code within the same time-step; assert the second use is rejected (one-time-use enforcement). | Integration |
| F-5 | P0 | State Transitions | Drive the login state machine: `unauthenticated → credentials-valid (challenge) → 2FA-valid (session)`; assert privileged routes are reachable ONLY in the final state, never the middle one. | E2E |
| F-6 | P0 | Security | Call a privileged route (`PUT /users/:id/suspend`) with a token whose `twoFactorVerified` is false/absent; assert `AdminAuthGuard` rejects it (currently the flag is hardcoded false and unchecked → G5). | Integration |
| F-7 | P1 | Error Handling | Submit a malformed code (`abc12`, `12345`, `1234567`, empty); assert 400/401 with no token issued and an `ADMIN_2FA_VERIFY_FAILED` audit entry. | Unit |
| F-8 | P1 | Security | Present a TOTP from a window that drifted ±1 step; assert acceptance within the allowed skew window and rejection outside it (no unbounded skew). | Unit |
| F-9 | P1 | Calculation | Compute expected HOTP/TOTP for known RFC 6238 test vectors against the chosen library; assert byte-exact match (proves the algorithm, not a stub). | Unit |
| F-10 | P1 | Security | Enroll 2FA, then attempt login as the same admin without presenting any code; assert privileged access is impossible (closes G1). | E2E |
| F-11 | P2 | Messaging | Trigger each failure branch; assert a distinct audit action (`ADMIN_2FA_VERIFY_FAILED` with reason) is persisted via `auditEntryRepository`. | Integration |
| F-12 | P2 | Security | Submit 2FA for a SUSPENDED/deleted admin (G8); assert rejection even with a correct code (admin existence + ACTIVE status re-checked at verify time). | Integration |

### D — Data (what the product PROCESSES)

The TOTP secret is the crown-jewel datum and currently has no home.

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| D-1 | P0 | Persistence | Enroll 2FA; query storage and assert the secret is persisted **encrypted/at-rest-protected**, never plaintext, and never returned in any API response body. | Integration |
| D-2 | P0 | Validation | Submit `code` containing leading/trailing whitespace, unicode digits (Arabic-Indic ٦٥٤), or `+0` notation; assert strict `^\d{6}$` ASCII handling rejects spoofed equivalents. | Unit |
| D-3 | P1 | Input | Send `x-admin-id` with SQL/UUID-shaped injection (`' OR '1'='1`, non-UUID); assert it is ignored entirely once session binding replaces the header (G4). | Integration |
| D-4 | P1 | Boundaries | Submit codes at numeric edges (`000000`, `999999`); assert they are treated as ordinary candidate codes, not special-cased. | Unit |
| D-5 | P1 | Persistence | Re-run enrollment for an admin who already has a secret; assert no silent secret overwrite without re-authentication (prevents secret-reset attack). | Integration |
| D-6 | P2 | Output | Inspect every login / verify / setup response and audit `details` JSON; assert no secret, QR seed, or full TOTP code is logged or echoed. | Integration |
| D-7 | P2 | Formats | Assert the enrollment QR/otpauth URI is well-formed (`otpauth://totp/...?secret=...&issuer=...`) and parseable by a standard authenticator. | Unit |
| D-8 | P3 | Storage | Confirm secret column has an appropriate length/charset and a migration exists; reject schema drift. | Human |

### I — Interfaces (how the product CONNECTS)

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| I-1 | P0 | APIs | POST `/api/admin/auth/verify-2fa` carrying ONLY a body code and a challenge token (no `x-admin-id`); assert identity is derived server-side from the challenge token, and any client-supplied `x-admin-id` is disregarded. | Integration |
| I-2 | P0 | APIs | Call `/api/admin/auth/verify-2fa` with NO authentication context at all; assert 401 (currently the endpoint trusts the header → identity forgery via G4). | Integration |
| I-3 | P1 | APIs | Send `x-admin-id` for admin A while the challenge token identifies admin B; assert the server uses B and rejects/ignores A (cross-identity confusion test). | Integration |
| I-4 | P1 | Protocols | Confirm `/login` and `/verify-2fa` reject non-HTTPS / accept only over TLS at the gateway; assert challenge tokens are never sent over plaintext. | Human |
| I-5 | P1 | APIs | Fuzz the `verify-2fa` body (missing `code`, array, nested object, oversized payload); assert 400 with class-validator messages, no 500s. | Integration |
| I-6 | P2 | APIs | Assert Swagger/OpenAPI for `verify-2fa` no longer documents `x-admin-id` as an input once removed; contract reflects reality. | Human |
| I-7 | P2 | User Interface | Drive the admin login UI through the 2FA prompt; assert the user cannot reach the dashboard by manipulating client state to skip the code entry step. | E2E |

### P — Platform (what the product DEPENDS ON)

TOTP is clock-dependent; the secret store is a new infrastructure dependency.

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| P-1 | P0 | External Software | Drop the secret store (DB/Redis) connection during `verify-2fa`; assert fail-CLOSED (access denied), never fail-open to "accept any code". | Integration |
| P-2 | P1 | Network | Set server clock +90s ahead of the authenticator; assert codes still validate within the configured skew window and fail beyond it. | Integration |
| P-3 | P1 | OS | Run the TOTP calculation under a non-UTC `TZ` env (`TZ=Asia/Kolkata`); assert codes still compute correctly (TOTP is UTC-epoch based, must be TZ-immune). | Unit |
| P-4 | P2 | External Software | Confirm behavior when the canonical `JwtTokenService` blacklist/issuer check is unavailable; assert privileged routes deny rather than degrade. | Integration |
| P-5 | P2 | Hardware | Profile secret-store reads under the verify path; assert each verify is a single bounded lookup (no N+1 / full-table scan enabling DoS). | Human |
| P-6 | P3 | Network | Simulate 500ms latency to the secret store; assert verify endpoint p95 stays within SLO and times out fail-closed. | Integration |

### O — Operations (how the product is USED)

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| O-1 | P0 | Admin Operations | Walk the full enrollment ceremony: authenticated admin requests setup → receives secret/QR → confirms with a real code → secret activated; assert privileged routes require 2FA only AFTER activation, and enrollment itself can't be skipped. | E2E |
| O-2 | P0 | Recovery | Attempt admin access with a lost authenticator (no recovery codes implemented yet); assert there is a defined, audited recovery path that itself requires strong re-verification — and document the gap if absent. | Human |
| O-3 | P1 | User Management | Suspend an admin mid-session; on next privileged call assert the session/token is rejected even though 2FA was previously satisfied (re-evaluation, not one-time gate). | Integration |
| O-4 | P1 | Extreme Use | Hammer `verify-2fa` with 10,000 sequential codes for one admin within the TOTP window; assert lockout/throttle engages and audits an `ADMIN_2FA_BRUTE_FORCE` style alert (closes G9). | Integration |
| O-5 | P1 | Admin Operations | Confirm the existing privileged operations (`suspend-user`, `unsuspend-user`, `get-audit-log`, `get-security-alerts`) all sit behind the 2FA-enforcing guard, not just `AdminAuthGuard` as-is. | E2E |
| O-6 | P2 | Recovery | Disable 2FA for an admin; assert the action requires a fresh 2FA challenge + is audited, preventing a single compromised session from silently removing the factor. | Integration |
| O-7 | P2 | Common Use | Happy-path: real admin logs in daily with rotating TOTP codes across consecutive 30s windows; assert no false rejections at window boundaries. | E2E |

### T — Time (WHEN things happen)

TOTP is fundamentally a time problem; this is the most under-tested dimension after Security.

| ID | Priority | Subcategory | Test Idea | Fitness |
|----|----|----|----|----|
| T-1 | P0 | Sequences | Attempt to call a privileged route using ONLY the post-login (pre-2FA) token; assert the ordering invariant holds — no privileged action before the 2FA step in the sequence (kills G1). | Integration |
| T-2 | P0 | Concurrency | Fire two `verify-2fa` requests with the same valid code in the same 30s step simultaneously; assert exactly one succeeds (one-time-use under race), the other is rejected. | Integration |
| T-3 | P1 | Scheduling | Submit a code exactly at the 30s boundary (T=29.9s vs T=30.1s); assert deterministic acceptance/rejection with no double-validity overlap beyond configured skew. | Unit |
| T-4 | P1 | Sequences | Expire the 15-minute admin session, then call a privileged route; assert re-authentication (and re-2FA) is forced, not silent renewal. | Integration |
| T-5 | P1 | Concurrency | Two admins enroll/verify concurrently; assert no secret cross-contamination (admin A's verify never validates against admin B's secret). | Integration |
| T-6 | P2 | Scheduling | Run a code generated just before a clock NTP correction jump; assert skew window absorbs minor drift but a large jump (>1 step) fails closed. | Human |
| T-7 | P2 | Sequences | Issue a challenge token, wait past its short TTL, then submit a correct code; assert the stale challenge is rejected (challenge-token expiry). | Integration |

---

## Test Data Suggestions (by factor)

**Structure** — `JWT_SECRET` unset / empty / default-string; package-lock with and without TOTP lib.
**Function** — RFC 6238 vectors (secret `12345678901234567890`, T=59 → `94287082`, T=1111111109 → `07081804`); codes `000000`, `999999`, `123456`, wrong-but-valid-format.
**Data** — `x-admin-id` payloads: valid UUID, malformed UUID, `' OR '1'='1`, 10KB string, null; codes with whitespace, Arabic-Indic digits, `+6`, hex.
**Interfaces** — bodies: `{}`, `{code:null}`, `{code:[1,2,3,4,5,6]}`, missing body, 1MB body; headers: spoofed `x-admin-id` mismatching token subject.
**Platform** — clock offsets {-60s, -30s, 0, +30s, +90s}; `TZ` in {UTC, Asia/Kolkata, America/Sao_Paulo}; secret-store down / 500ms latency.
**Operations** — admins in states {ACTIVE, SUSPENDED, deleted, never-enrolled, enrolled}; recovery-code present/absent.
**Time** — submit at step boundary T∈{0.0s, 29.9s, 30.1s, 59.9s}; duplicate-code concurrent pairs; expired challenge tokens.

---

## Exploratory Test Sessions (by factor)

- **Suggestions for Exploratory Test Sessions: Structure** — Trace every token-signing call site in the admin module; map which secret signs what and which guard verifies it. Hunt for the two-token-system seam (G3).
- **Suggestions for Exploratory Test Sessions: Function** — Tour the auth state machine trying to reach privileged routes through every "side door": login token alone, 2FA token alone, mixed tokens, replayed codes.
- **Suggestions for Exploratory Test Sessions: Data** — Probe where the TOTP secret lives once implemented; attempt to read it via API responses, audit logs, error stack traces, and Swagger examples.
- **Suggestions for Exploratory Test Sessions: Interfaces** — Manipulate `x-admin-id` against the challenge token in every combination; attempt identity confusion and privilege grant for another admin.
- **Suggestions for Exploratory Test Sessions: Platform** — Skew clocks, kill the secret store mid-verify, swap timezones; observe fail-open vs fail-closed behavior.
- **Suggestions for Exploratory Test Sessions: Operations** — Role-play a compromised-credentials attacker who has password but not the phone; document every path that still grants access.
- **Suggestions for Exploratory Test Sessions: Time** — Race concurrent verifies, exploit the 30s window, replay codes across boundaries, exhaust challenge-token TTL.

---

## Clarifying Questions (gap-driven — suggestions based on general risk patterns)

1. **Session binding mechanism:** What is the server-issued artifact that binds login → 2FA → session? A short-lived challenge token (preferred) or a server-side session record? The story says "server-issued session" but no session store exists in the admin module today.
2. **Single token authority:** Will both flows mint via the canonical `JwtTokenService`? The current `JwtModule` second signer (G3) must be removed or the 2FA token will never pass `AdminAuthGuard`.
3. **Guard enforcement:** Will `AdminAuthGuard` be upgraded to actually check `twoFactorVerified` (currently hardcoded false, G5), or will a new `TwoFactorGuard` wrap privileged routes?
4. **Recovery / backup codes:** Is account recovery in scope? Without it, a lost authenticator = permanent admin lockout (O-2). This is a hard operational dependency.
5. **Brute-force protection:** Is rate-limiting/lockout in scope for this story or deferred? A real TOTP gate without throttling (G9) is still brute-forceable in the 30s window.
6. **Enrollment bootstrap:** How does an admin enroll the first factor — during the same login that will later require it? Define the chicken-and-egg flow (O-1).
7. **Secret storage location & encryption:** ~~DB column vs Redis? Encrypted at rest with which key?~~ **Resolved by peer (`05-dependency-map.md`):** DB column, AES-256-GCM via Node stdlib `crypto` (no new dep), keyed by a new `TOTP_ENCRYPTION_KEY`, plus a migration. Remaining question for refinement: key rotation policy and who owns the key in deploy/ops.
8. **Re-verification cadence:** Does 2FA gate every privileged action, only session creation, or step-up for high-risk actions (suspend/unsuspend)? Affects O-3, T-4.
9. **Suspended-admin during active session:** Must privileged calls re-check admin ACTIVE status (G8/O-3), or is the 15-min token authoritative until expiry?
10. **Admin-role provenance (raised by SoD peer, `05-sod-analysis.md`):** This story gates *authentication* but not *who is actually an admin*. `admin-login` self-grants `admin` to any active member. Is fixing role provenance (a real admin store / persisted `AdminRole`) in scope for this story, a hard predecessor, or a separate story? 2FA is meaningless if every member can pass through it as "admin."
11. **TOTP library + DDD placement:** Accept the peer recommendation `otplib@^12` and keep TOTP/crypto out of `libs/domain/admin`? (See S-8/S-11.)

---

## Quality Metrics

| Metric | Value |
|---|---|
| Total test ideas | 58 (53 SFDIPOT + 5 added from peer dependency findings, S-8…S-12) |
| Priority — P0 | 19 (32.8%) — intentionally elevated; this is a security-invariant story currently inverted |
| Priority — P1 | 25 (43.1%) |
| Priority — P2 | 12 (20.7%) |
| Priority — P3 | 2 (3.4%) |
| Fitness — Unit | 17 (29%) |
| Fitness — Integration | 28 (48%) |
| Fitness — E2E | 7 (12%) |
| Fitness — Human | 6 (10%) |

> Note on distribution: standard P0 budget is 8–12%, but the verified ground truth shows the core security invariant is *inverted* (credentials alone = full admin). Risk-based weighting deliberately concentrates P0 on the security/state/time factors until the invariant is proven restored. Integration fitness dominates because the defects live at the seam between handlers, guard, token service, and secret store — not in isolated units.
> Cross-validated by 3 independent peer refinement agents (Contract Validation, Segregation of Duties, Dependency Mapping); all three converged on the same critical defects, and SoD surfaced a deeper prerequisite (admin-role provenance, SoD-1) that this story must reckon with.

---

## Top 5 Highest-Risk Product Factors

1. **Function / Security (authorization provenance + 2FA)** — Two compounding root defects: (a) `verify-2fa` accepts any 6-digit code and login already grants full admin without 2FA; (b) `admin-login` self-grants the `admin` role to *any active member* with no admin store (SoD-1, confirmed by peer). The product does the *opposite* of the story's intent, and even a perfect 2FA gates the wrong population.
2. **Time / Sequences & Concurrency** — No ordering invariant (privileged access reachable pre-2FA), no one-time-code enforcement, no replay protection across the 30s window.
3. **Interfaces / APIs** — Client-supplied `x-admin-id` lets an attacker forge which admin identity the (already-trivial) 2FA token is minted for; `/verify-2fa` is also in an undefined auth state (neither `@Public()` nor guarded).
4. **Data / Persistence** — The TOTP secret has no storage, encryption, or lifecycle; the "real TOTP" premise has no foundation. Peer confirms the fix path: AES-256-GCM via stdlib `crypto` + `TOTP_ENCRYPTION_KEY` + migration.
5. **Operations / Recovery & Admin Ops** — No lockout/throttle, no recovery path, and no re-evaluation of admin status mid-session.

## Single Most Dangerous Untested Dimension

**The end-to-end privilege-grant sequence (Time / Sequences, F-5 + T-1 + F-6 + G1).** Even if `verify-2fa` were fixed to validate real TOTP codes, `admin-login.handler.ts` *already returns a fully-privileged canonical admin token with `requiresTwoFactor: false`*, and `AdminAuthGuard` never checks `twoFactorVerified`. So the 2FA step is decorative — bypassable by simply ignoring it. There is **zero test today asserting that a post-login/pre-2FA token cannot perform a privileged action.** That single missing assertion is the difference between "2FA implemented" and "2FA enforced," and it is the one thing that makes the story's security promise true or false.
