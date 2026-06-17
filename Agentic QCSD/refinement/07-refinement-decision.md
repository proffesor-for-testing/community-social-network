# QCSD Refinement Decision — Admin Authentication & TOTP 2FA

**Date:** 2026-06-16 · **Branch:** `ddd-approach` · **Swarm:** qcsd-refinement-swarm (7 agents)
**Refinement subject:** "Admin login must require real TOTP 2FA and bind identity to a server-issued session, so that credentials alone are NOT sufficient for admin access."

## DECISION: 🔴 NOT-READY (for single-sprint commitment as written)

The story is **valuable and correctly aimed but not yet refined enough to commit**, and it rests
on a missing predecessor (real admin-role provenance). It is a security *epic*, not a story.

---

## Why NOT-READY (evidence from the swarm)

| Agent | Verdict | Decisive evidence |
|-------|---------|-------------------|
| Requirements (INVEST) | CONDITIONAL→NOT-READY | 19/30; testability 5/10; bundles 5 deliverables (enroll/verify/bind/enforce/persist) → fails *Small* & *Estimable* |
| SoD / Authorization | CRITICAL gap | **PE-1:** any active member → full admin; no admin check at login; `Member` has no `isAdmin` field |
| Product Factors (SFDIPOT) | 19 P0 of 58 | Core security invariant is **inverted** in code, not merely incomplete |
| BDD | 9 scenarios fail today | Credential-less escalation: `x-admin-id` + `code:"000000"` → 15-min admin token |
| Contract | **Broken** on 3 layers | `verify-2fa` signs via `JwtService`; guard verifies via `JwtTokenService` — 2FA token rejected by every protected route |
| Dependency | Buildable | Use `otplib@^12` + Node `crypto` AES-256-GCM (no new crypto dep); 6 modules across 3 layers impacted |

### The single most important finding
**This is not a "finish 2FA" story — it is a "there is no admin authorization at all" story.**
`admin-login.handler.ts:55-96` grants `roles:['admin','member']` to anyone who knows *any* active
member's password. Even a flawless TOTP implementation gates the wrong population. The code comment
admits the check "was never implemented."

### Two traps that would waste the sprint if not resolved first
1. **Predecessor missing:** real admin-role provenance (an admin store / `isAdmin` flag / grant flow) must exist *before* 2FA is meaningful. Decide: in-scope or a predecessor story.
2. **Token unification:** `verify-2fa` must mint via the canonical `JwtTokenService`, or the work produces tokens nothing accepts.

---

## Path to READY (recommended split)

Sequence smallest-slice-that-closes-the-bypass first:

- **Story A — Admin role provenance** *(predecessor, blocks everything)*: admin store + grant; login derives `admin` only from it. Closes PE-1.
- **Story B — Enforce 2FA ordering**: login returns a pre-2FA challenge token only; `AdminAuthGuard` reads `twoFactorVerified` (today hardcoded `false` at `admin-auth.guard.ts:45`). Closes PE-2.
- **Story C — Real TOTP**: `otplib`, encrypted secret store (AES-256-GCM), enrollment + verify; remove `x-admin-id` (bind to challenge token). Closes C-01/C-02.
- **Story D — Hardening**: throttle/lockout (`@nestjs/throttler` already present), recovery codes, replace fallback secret `'admin-jwt-secret-change-me'`.

## Definition of Ready checklist (currently failing)
- [ ] 10 acceptance criteria adopted (drafted in `04-requirements-validation.md`)
- [ ] Story split A–D; each independently estimable & ≤1 sprint
- [ ] Admin-role provenance decision made (in-scope vs predecessor)
- [ ] Token issuer unified to `JwtTokenService`
- [ ] 6 open design questions answered (session model, drift/RFC params, enrollment bootstrap, recovery, role provenance, challenge-token lifetime)

## The 5 must-pass regression tests (prove the bypass is closed)
1. **PE-04** — pre-2FA token on `PUT /admin/users/:id/suspend` → 401, victim unchanged
2. **2FA-01** — `code:"000000"` for enrolled admin → 401, no JWT, audited
3. **TOK-03** — forged `x-admin-id` + `code:"000000"` → 401, no token
4. **PE-01** — ordinary member at `/admin/auth/login` → 401/403, no `admin` role in token
5. **2FA-08** — rapid invalid codes → 429 + brute-force alert on 5th attempt

---

## Artifacts
`02-product-factors.md` · `03-bdd-scenarios.md` · `04-requirements-validation.md` ·
`05-contract-validation.md` · `05-dependency-map.md` · `05-sod-analysis.md` · `06-test-ideas-active.md`
