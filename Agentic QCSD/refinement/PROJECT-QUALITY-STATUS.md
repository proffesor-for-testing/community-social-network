# Project Quality Status — Honest Snapshot

**Date:** 2026-06-16
**Branch:** `ddd-approach`
**Context:** Development in progress (active edits in another terminal during this run)
**Verdict:** 🔴 **NOT-READY** for production / release. Architecture is sound; correctness, security, and tooling are not.

---

## Evidence (measured this run, not claimed)

| Signal | Result | Method |
|--------|--------|--------|
| Unit/integration tests | **1096 pass / 45 fail (1141 total), 6 files failing (~96%)** | `vitest run` direct |
| `npm test` (nx) | **Broken** — `NX Missing field 'version'`, exits 0 | `npm test` |
| `npm build` (nx) | **Broken** — `NX Required property 'main' is missing`, exits 0 | nx run-many |
| Critical security blockers | **2 confirmed still live in code** | source inspection |
| Frontend (web) tests | **1 test file** for the entire React app | file scan |
| Real DB (Postgres) repo tests | **~1 file** — repos tested in-memory only | file scan |
| Domain layer substance | **Real logic** across 8 bounded contexts (~5,200 LOC) | line counts |

---

## 🔴 Blockers (must fix before any release)

### B1 — `nx test` / `nx build` are broken AND exit 0
`npm test` and `npm build` print `NX Missing field 'version'` / `Required property 'main'`
then **return exit code 0**. CI would go **green while running nothing**. This is the most
dangerous kind of failure: silent. (Note: config may be mid-edit in the other terminal —
re-verify after current work lands.)

### B2 — Admin 2FA is a bypass stub (CONFIRMED in code today)
`apps/api/src/modules/admin/commands/verify-2fa.handler.ts:52` —
`// TODO: Verify TOTP code against stored secret` — accepts **any** valid 6-digit string.
No secret is generated, stored, or verified. CVSS ~9.8.

### B3 — `x-admin-id` header trust → privilege escalation (CONFIRMED in code today)
`apps/api/src/modules/admin/controllers/admin-auth.controller.ts:52` reads `adminId`
from a **client-supplied header** with no session binding. Combined with B2, any caller can
mint a fully-signed admin JWT for any UUID. CVSS ~9.1.

### B4 — 45 failing tests across 6 files
Dominant signature: `TypeError: Cannot read properties of undefined (reading 'execute')`
in controller specs (e.g. `social-graph/__tests__/connection.controller.spec.ts`) — handler
mocks not provided in `Test.createTestingModule`. **Pre-existing**, not caused by the
in-flight auth refresh-token work (that touches identity/auth only).

---

## 🟡 Real gaps (not blockers, but the "85% coverage" claim is not true)

- **Frontend is effectively untested** — 1 spec for the whole web app.
- **Persistence is untested against a real DB** — repositories validated in-memory; TypeORM
  mapping, migrations, and query behavior are unverified.
- **README overclaims** — "Ready", "Production", "85%+ coverage" are aspirational targets
  stated as status. Reality is ~96% *unit* pass with large layers uncovered.

---

## 🟢 Genuine strengths (don't lose these)

- **Architecture is the real deal**: clean DDD with 8 bounded contexts, domain/infrastructure/
  application separation, CQRS handlers, value objects, domain events. Not stub-ware — the
  domain layer carries actual business logic.
- **Test breadth at the unit level is good** (1,100+ tests) where it exists.
- **The team is honest with itself** — `docs/qe-reports/QE-MASTER-REPORT.md` already scored
  this 68/100 FAILED with the same security blockers. That self-awareness is a quality asset.

---

## Honest bottom line

This is a **well-architected project that is mid-development, not near-done.** The skeleton
(DDD, CQRS, domain modeling) is better than most. But it is **not shippable**: two critical
auth bypasses are live, the build/test commands silently no-op, 45 tests are red, and two
whole layers (frontend, persistence) are essentially unverified.

Roughly: **architecture A-, correctness C, security D, release-readiness F.**

### Suggested order of work
1. **Fix B1 first** — a build/test that lies makes every other signal untrustworthy.
2. **Fix B2/B3** — real TOTP (otplib/speakeasy) + server-bound pre-2FA session token.
3. **Green the 45 tests** — mostly test-setup DI wiring.
4. **Then** add frontend + real-DB integration coverage before claiming any coverage number.
