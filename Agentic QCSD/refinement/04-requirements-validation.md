# Requirements Validation — Admin 2FA & Session Binding

**Phase:** QCSD Refinement (Sprint Commitment)
**Validator role:** Requirements Validator (INVEST + testability)
**Date:** 2026-06-16
**Branch:** ddd-approach

## Refinement Subject

> As a platform operator, admin login must require real TOTP-based 2FA and bind admin
> identity to a server-issued session, so that obtaining admin credentials alone is NOT
> sufficient to gain admin access.

## Code Grounding (verified today)

| Location | Verified state | Implication for the story |
|---|---|---|
| `verify-2fa.handler.ts:39,52` | Only checks `/^\d{6}$/` format, then issues a 15m JWT. `// TODO: Verify TOTP code against stored secret`. Any 6-digit string passes. | No real TOTP verification exists. The "second factor" is currently theater. |
| `admin-auth.controller.ts:50-52` | `adminId` is read from a **client-supplied** `x-admin-id` header ("...as a placeholder"). | Caller chooses whose admin token to mint. 2FA can be invoked for an arbitrary identity. Identity is NOT server-bound. |
| `setup-2fa.handler.ts:34-38` | `// TODO`: generate secret, verify, store encrypted, return QR. Returns `enabled: true` unconditionally after format check. | No secret is ever generated or persisted. There is nothing to verify against. |
| `admin-login.handler.ts:100` | `requiresTwoFactor: false // Placeholder`. Login already mints a **full** `['admin','member']` access token via `JwtTokenService`. | The 2FA step is entirely bypassable — login alone already returns an admin-capable token. This is the critical gap the story must close. |
| `admin-login.handler.ts:54` | `// admin role would be verified from a separate admin table or role field` — not implemented; any ACTIVE member with the password is treated as admin. | Adjacent gap; affects "bind admin identity" but is arguably out of this story's scope. Flag as dependency. |
| `admin-auth.guard.ts:45` | Sets `twoFactorVerified: false` hard-coded; never reads the claim from the token. | Even the post-2FA token's `twoFactorVerified: true` claim is ignored downstream. The guard cannot currently enforce "2FA-verified" sessions. |
| `@csn/domain-admin` (package) | No `TwoFactorSecret` / `totpSecret` value object or entity exists anywhere outside the apps layer (grep returned nothing). | There is **no persistence substrate** for TOTP secrets. This is net-new domain modeling, not a tweak. |

**Headline:** The story is not a refinement of a working flow — it describes building a real
second factor and server-side session binding where today **both are stubs and login already
bypasses 2FA entirely**. This shapes scope, sizing, and testability.

---

## 1. INVEST Scoring

| Letter | Score | Justification (code-grounded) |
|---|---|---|
| **Independent** | 3/5 | Mostly self-contained within the admin module, but has a real upstream dependency: there is **no TOTP secret store** in `@csn/domain-admin` and no `twoFactorVerified` enforcement in `admin-auth.guard.ts`. The story implicitly requires new domain modeling (secret value object + repository + migration) and a guard change. Not blocked by another team, but not cleanly isolated either. |
| **Negotiable** | 4/5 | The *what* (real TOTP + server-bound session) is firm and security-driven, appropriately non-negotiable. The *how* is open: temporary login token vs. short-lived server session, secret encryption strategy, recovery codes yes/no, drift window size. Good room for the team to shape implementation. |
| **Valuable** | 5/5 | Clear, high operator/security value, explicitly stated in the "so that" clause. Directly closes a live privilege-escalation path: today `admin-login.handler.ts:100` mints a full admin token with no second factor. Defensible business value. |
| **Estimable** | 2/5 | Cannot be reliably sized as written. Hidden work: new TOTP secret domain object, encrypted persistence + migration, replacing the `x-admin-id` header with a server-issued intermediate token, wiring `twoFactorVerified` enforcement into the guard, audit-log assertions, time-drift handling. The "must require real 2FA" wording hides at least 4–5 distinct deliverables. Spike likely needed before commitment. |
| **Small** | 2/5 | Too large for confident single-sprint commitment as one unit. It bundles: (a) setup/enrollment flow, (b) verification flow, (c) session/identity binding, (d) guard enforcement, (e) domain + persistence. Each is independently testable and shippable. Should be split (see Readiness). |
| **Testable** | 3/5 | The *outcome* is testable and falsifiable ("credentials alone are not sufficient"), which is the strongest part. But testability is currently undermined by non-determinism (TOTP is time-based) and missing seams (no injectable clock, no secret store to seed). Testable in principle, but the design must expose the right seams — see Section 2. |

**INVEST total: 19 / 30**

Profile: strong *Valuable* and *Negotiable*, weak *Estimable* and *Small*. This is the classic
signature of a security epic masquerading as a single story.

---

## 2. Testability Assessment

**Overall testability score: 5 / 10 (as written) — raises to ~8/10 if the AC below are adopted and the design exposes the seams noted.**

### Controllability — can we drive the inputs deterministically? (currently LOW)
- **TOTP is time-based.** A correct 6-digit code depends on the current 30s window and the shared secret. To test deterministically we must control **both** the secret and the clock.
  - *Required seam:* an injectable time source (clock provider) so tests can pin the window. Without it, tests must compute the live code at runtime — flaky near window boundaries.
  - *Required seam:* a seedable secret store. Today none exists (`@csn/domain-admin` has no TOTP secret type), so there is nothing to seed.
- **Identity is currently caller-controlled** via `x-admin-id`. Once replaced by a server-issued intermediate token, controllability of identity must come from completing the login step, not from a header — tests must drive the real two-step flow.

### Observability — can we see the outcome? (currently MEDIUM)
- Good: every branch already writes an `AuditEntry` (`ADMIN_2FA_VERIFY_FAILED`/`SUCCESS`, `ADMIN_LOGIN_SUCCESS`). Audit log is a strong observation point and should be asserted on.
- Good: JWT claims (`twoFactorVerified: true`, `type: 'admin'`) are observable on the issued token.
- Gap: `admin-auth.guard.ts:45` hard-codes `twoFactorVerified: false` and never reads the claim — so the *enforcement* outcome is currently NOT observable end-to-end. The AC must require the guard to read and enforce the claim, otherwise we can only test token minting, not actual access protection.

### Isolateability — can we test units without the whole world? (currently MEDIUM)
- Handlers are DI-based (repositories + `JwtService` injected), so unit isolation is feasible.
- JWT signing is deterministic given a fixed secret/clock — isolable.
- The missing TOTP library/service should be introduced behind an interface (e.g. `ITotpVerifier`) so it can be stubbed in unit tests and exercised for real in one integration test.

### External dependencies to pin in tests
| Dependency | Risk | Test strategy |
|---|---|---|
| TOTP time window | Flaky near 30s boundary | Inject clock; pin to fixed instant; also test the ±1 window drift tolerance explicitly. |
| Shared TOTP secret | Must be seeded | Seedable encrypted secret store; fixed known secret in test fixtures to derive expected codes. |
| JWT signing | Generally deterministic | Fixed signing key + injected clock for `exp`; assert claims, not raw token string. |
| Audit log repository | Side-effect ordering | In-memory fake repo; assert entries by action + actor. |
| Code reuse / replay | Time-sensitive security property | Requires a "consumed code" record or window-based replay guard — must be designed for, and is testable only if that state is observable. |

**Conclusion:** The flow *can* be tested deterministically, but **only if the implementation
introduces an injectable clock, a seedable secret store, and a `twoFactorVerified` enforcement
point in the guard.** As written today, it is not deterministically testable. These seams must be
named in the AC so they aren't omitted.

---

## 3. Drafted Acceptance Criteria (currently ZERO exist)

Concrete, testable, Given/When/Then-able. Grouped to expose natural story splits.

### Group A — Enrollment / Setup (`setup-2fa.handler.ts`)
- **AC-1 (secret generation):** Given an authenticated admin with no 2FA enrolled, when they request 2FA setup, then the server generates a TOTP secret, persists it **encrypted**, and returns provisioning data (otpauth URI / QR) — and the secret is never returned in plaintext after enrollment.
- **AC-2 (setup confirmation):** Given an admin who received a provisioning secret, when they submit a TOTP code **derived from that secret within the current window**, then 2FA is marked enabled; when they submit a code NOT derived from that secret, then setup is rejected and no enabled state is persisted. (Today `setup-2fa.handler.ts` returns `enabled: true` for any 6-digit string — this AC kills that.)

### Group B — Verification (`verify-2fa.handler.ts`)
- **AC-3 (real verification):** Given an enrolled admin with a known secret, when they submit the **correct** current TOTP code, then a session/access token is issued; when they submit a **format-valid but incorrect** 6-digit code (e.g. `000000` when not current), then verification is rejected with 401 and `ADMIN_2FA_VERIFY_FAILED` is logged. (Today any 6-digit code succeeds — this is the core fix.)
- **AC-4 (drift tolerance, explicit):** Given an enrolled admin, when they submit a code valid for the immediately previous 30s window (±1 step), then verification succeeds; when they submit a code older than the configured drift window, then it is rejected. (Makes the time-window behavior deterministic and specified, not accidental.)
- **AC-5 (replay protection):** Given a TOTP code that was already successfully used, when the same code is submitted again within its window, then verification is rejected. (Security property; must be designed to be observable.)

### Group C — Identity & Session Binding (`admin-auth.controller.ts`, `admin-login.handler.ts`)
- **AC-6 (no client-supplied identity):** Given the verify-2fa endpoint, when a request supplies an `x-admin-id` header, then it is **ignored**; the admin identity is taken **only** from a server-issued intermediate token produced by the login step. (Directly removes the `x-admin-id` trust at `admin-auth.controller.ts:52`.)
- **AC-7 (login no longer mints admin access alone):** Given valid admin credentials, when login succeeds, then the response is an **intermediate/2FA-pending token that does NOT grant admin access**, and `requiresTwoFactor: true`. (Today `admin-login.handler.ts:92-100` returns a full `['admin','member']` token with `requiresTwoFactor: false` — this AC closes the bypass that makes credentials alone sufficient.)
- **AC-8 (full token only post-2FA):** Given a valid intermediate token, when the correct TOTP code is verified, then and only then is a token carrying admin authority and `twoFactorVerified: true` issued.

### Group D — Enforcement (`admin-auth.guard.ts`)
- **AC-9 (guard enforces 2FA claim):** Given a request to an admin-only route, when the bearer token lacks `twoFactorVerified: true`, then access is denied (401/403). (Today the guard hard-codes `twoFactorVerified: false` at line 45 and never enforces it — without this AC, AC-7/8 are observable only at the token, not at the gate.)

### Group E — Auditability (cross-cutting, already partially present)
- **AC-10 (audit completeness):** Given any 2FA setup, verification success, or verification failure, when it occurs, then an `AuditEntry` is persisted with the action, the **server-resolved** admin id, and source IP — and the failure reason distinguishes "invalid format" from "incorrect code" from "replay".

**Acceptance criteria drafted: 10** (across 5 groups; Groups A–D are candidate story splits).

---

## 4. Ambiguities & Definition-of-Ready Gaps

### Ambiguities to resolve before commitment
1. **"server-issued session"** — JWT-only (stateless, as today) or a revocable server-side session record? This changes the persistence model and the testability of logout/revocation. Undefined.
2. **"real TOTP-based 2FA"** — which library / RFC 6238 parameters (period 30s? digits 6? algorithm SHA-1?) and what drift window? Unspecified; affects AC-4.
3. **Enrollment trigger** — who enrolls admins, when, and what is the bootstrap path for the *first* admin (chicken-and-egg: can't require 2FA to enroll the first admin)? Undefined.
4. **Recovery / lockout** — what happens when an admin loses their authenticator? No recovery codes or break-glass path mentioned. A 2FA story without recovery is operationally incomplete.
5. **Admin-role source** — `admin-login.handler.ts:54` notes admin role isn't really verified from an admin table. "Bind admin identity" is ambiguous if any ACTIVE member is effectively admin. Clarify whether role provenance is in-scope.
6. **Intermediate token lifetime & scope** — how long is the 2FA-pending window valid, and what can it do? Undefined.

### Definition-of-Ready gaps
- [ ] **No acceptance criteria existed** — now drafted (10), need product/security sign-off.
- [ ] **No domain model for TOTP secrets** — `@csn/domain-admin` lacks a secret value object/entity and repository; a migration is implied but unscoped. Needs a design spike.
- [ ] **Story is not Small/Estimable** — should be split along Groups A–D (Enroll, Verify, Bind, Enforce) before sprint commitment.
- [ ] **No testability seams defined** — injectable clock, seedable secret store, and guard-claim enforcement must be explicit design constraints, else the flow remains non-deterministic.
- [ ] **No dependency on encryption/secret-management decision** — at-rest encryption strategy for the TOTP secret is unstated.
- [ ] **No replay/drift policy** — security behavior (AC-4, AC-5) needs a product/security decision to be specified.

---

## Requirements-Perspective Recommendation

**Verdict: CONDITIONAL (lean NOT-READY for single-sprint commitment as one story).**

The intent is valuable, falsifiable, and security-critical — and the code confirms it is closing a
**real, live bypass** (login alone currently yields an admin token; 2FA accepts any 6-digit code;
identity is client-supplied). However, the story:
- has **zero** acceptance criteria today,
- depends on **net-new domain modeling** (no TOTP secret store exists),
- is **too large and not estimable** as one unit (5 distinct deliverables),
- is **not deterministically testable** until injectable clock + seedable secret + guard enforcement seams are committed.

**To reach READY:** (1) accept the 10 drafted AC, (2) split into Groups A–D as separate stories,
(3) run a short spike on TOTP secret domain modeling + encryption, (4) resolve the six ambiguities
(session model, RFC params/drift, enrollment/bootstrap, recovery, admin-role provenance, intermediate
token lifetime). The **Verify + Bind + Enforce** slice (Groups B/C/D) is the highest-value, smallest
shippable unit that actually closes the bypass and should be sequenced first.
