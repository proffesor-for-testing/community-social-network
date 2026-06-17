# 05 — Dependency Map: Real TOTP 2FA for Admin Auth

**Phase:** QCSD Refinement
**Subject:** Completing real TOTP 2FA for admin auth requires introducing a TOTP library (otplib or speakeasy) and an encrypted secret store.
**Flag:** HAS_DEPENDENCIES = TRUE
**Author:** Dependency Mapper
**Date:** 2026-06-16

---

## 1. Current Dependency Baseline (root `package.json`)

### 1.1 No TOTP / OTP library present — CONFIRMED

A full scan of `dependencies` and `devDependencies` in `/workspaces/community-social-network/package.json` shows **NO** TOTP/OTP/2FA library. None of the following are installed:

- `otplib` — absent
- `speakeasy` — absent
- `otpauth` — absent
- `notp`, `time2fa`, `@levminer/speakeasy` — absent
- No QR-code generation lib (`qrcode`) either — needed to render the authenticator enrollment QR.

The current 2FA code is a **stub**: it only regex-validates a 6-digit format and never checks a TOTP code against a secret (see Section 3.3 for evidence).

### 1.2 Existing auth / crypto dependencies

| Package | Version (range) | Role | Reusable for TOTP work? |
|---|---|---|---|
| `bcrypt` | `^5.1.1` | Admin password hashing (`admin-login.handler.ts`) | No (hashing, not TOTP) |
| `@types/bcrypt` (dev) | `^5.0.2` | Types for bcrypt | n/a |
| `jsonwebtoken` | `^9.0.2` (resolved `9.0.2`) | Low-level JWT signing | Indirect |
| `@nestjs/jwt` | `^10.2.0` | NestJS JWT wrapper, used in `admin.module.ts` and `verify-2fa.handler.ts` | Token issuance after 2FA pass |
| `@nestjs/passport` | `^10.0.3` | Passport integration | No |
| `passport` | `^0.7.0` | Auth strategy base | No |
| `passport-jwt` | `^4.0.1` | JWT bearer strategy | No |
| `@types/passport-jwt` (dev) | `^4.0.1` | Types | n/a |
| `helmet` | `^8.1.0` | HTTP hardening | No |
| `@nestjs/throttler` | `^6.5.0` | Rate limiting — **relevant**: should throttle TOTP verify attempts | Yes (brute-force guard) |
| Node built-in `crypto` | (stdlib) | Used in `libs/infrastructure/auth/key-rotation.service.ts` (`randomBytes`) and `jwt.service.ts` | **Yes — base for encrypted secret store (AES-256-GCM)** |

**Key finding:** There is currently **no AES/symmetric-encryption helper** in the codebase. The only `crypto` usage is `randomBytes`/`randomUUID` for key material in `key-rotation.service.ts`. The encrypted TOTP secret store must introduce a new envelope-encryption helper (Node `crypto` `createCipheriv` with `aes-256-gcm`). This requires **no new npm dependency** — the encryption side is satisfiable with the Node stdlib.

---

## 2. TOTP Dependency Recommendation: `otplib`

### 2.1 otplib vs speakeasy

| Criterion | `otplib` | `speakeasy` |
|---|---|---|
| Maintenance | Actively maintained; modular (`@otplib/preset-default`); modern TS-friendly | Effectively **unmaintained** — last meaningful release ~2017; many open issues; community has migrated away |
| TypeScript | First-class typings shipped | Requires `@types/speakeasy` (community), drift risk |
| Crypto backend | Pluggable; uses Node `crypto` HMAC; no heavy native deps | Uses Node `crypto`; bundles `base32.js` |
| API ergonomics | `authenticator.generateSecret()`, `.generate()`, `.verify({token, secret})`, `.keyuri()` for QR provisioning URI | `generateSecret()`, `totp.verify()`; verify window handling is clunkier |
| RFC 6238 compliance | Yes, configurable step/window/digits | Yes |
| Transitive footprint | Small. `@otplib/core` + `@otplib/plugin-crypto` + `@otplib/plugin-thirty-two`. No native compilation. | Small but stale; `base32.js` is old |
| Security advisories | No known active CVEs on current line | Stale package = higher latent supply-chain risk |

### 2.2 Decision

**Use `otplib`** (recommended `^12.0.1`, the current stable line).

Rationale: active maintenance, shipped TypeScript types, RFC 6238 compliant, pluggable crypto using Node stdlib, and a clean `keyuri()` helper for generating the `otpauth://` provisioning URI consumed by authenticator apps. `speakeasy` is rejected primarily on the **unmaintained / stale** criterion — adopting a dormant security-critical dependency is itself a risk.

### 2.3 Version + transitive risk

- **Pin:** `otplib@^12.0.1`.
- **Transitive deps:** small, pure-JS chain (`@otplib/core`, `@otplib/plugin-crypto`, `@otplib/plugin-thirty-two`). **No native/`node-gyp` build** (unlike `bcrypt`), so it will not complicate the Docker/CI build that recently had first-start build issues (commit `fe8ec18`).
- **QR rendering:** to return a scannable QR (not just the `otpauth://` URI), add `qrcode@^1.5.x` (or render client-side from the URI to avoid a new server dep — preferred to keep the dependency surface minimal). The `setup-2fa.handler.ts` TODO explicitly calls for "Return QR code data URI", so decide consciously: **server-side `qrcode`** (+1 dep, +`@types/qrcode` dev) vs **client-side rendering of the URI** (0 new deps). Recommendation: client-side rendering to minimize new dependencies.
- **Engines:** project requires Node `>=20`; `otplib` supports this comfortably.

---

## 3. Coupling / Module Impact Map

The codebase is an **NX monorepo with DDD bounded contexts**. The admin context already has a 2FA scaffold across all three layers, so the feature is an *implementation fill-in*, not a greenfield wiring. The dependency direction is `apps/api` → `libs/infrastructure/*` → `libs/domain/*` (clean onion / hexagonal layering).

### 3.1 Modules that MUST change

| # | Layer | Module / path | Change required | New external dep touches here? |
|---|---|---|---|---|
| 1 | Domain | `libs/domain/admin` | Add a `TotpSecret` value object (or `TwoFactorSecret`) and possibly a domain event `Admin2faEnabledEvent`; export from `src/index.ts` (currently exports only `AdminRole`, `AuditEntryId`, `IpAddress`, `AuditEntry`, `IAuditEntryRepository`). Add a repository **interface** `ITotpSecretRepository`. | No (domain stays pure — interface only) |
| 2 | Infrastructure | `libs/infrastructure/admin` | Implement encrypted secret persistence: new TypeORM entity `admin_totp_secrets`, a **new migration** (the existing `1710000006000-create-admin-tables.ts` has **no** TOTP/secret table — confirmed), a mapper, a Postgres repo + in-memory repo, an `EncryptionService` (Node `crypto` AES-256-GCM) and DI token `TOTP_SECRET_REPOSITORY`. Wire into `admin.infrastructure.module.ts`. | **Yes — encryption (Node `crypto`, stdlib)** |
| 3 | Infrastructure | `libs/infrastructure/auth` *(optional)* | If the AES `EncryptionService` is intended to be shared, it could live here (already holds `key-rotation.service.ts` and `randomBytes` usage) rather than in `infra-admin`. Decision point — see risk R4. | Possibly |
| 4 | Application | `apps/api/src/modules/admin` | Replace stubs in `commands/setup-2fa.handler.ts` and `commands/verify-2fa.handler.ts` to call `otplib` (`authenticator.generate/verify`) against the decrypted stored secret; update `commands/admin-login.handler.ts` to return `requiresTwoFactor: true` when a secret exists (currently hardcoded `false`, line 100). Register the new repository provider + `otplib` usage in `admin.module.ts`. DTOs `setup-2fa.dto.ts` / `verify-2fa.dto.ts` already exist. | **Yes — `otplib` imported in handlers** |
| 5 | Frontend | `apps/web/src/features/admin` | `queries.ts` already references 2FA endpoints; needs QR/enrollment UI + verify step. Client-side QR rendering decision lands here. | Possibly (client QR lib) |
| 6 | Config / Ops | env + Docker/CI | New secret: `TOTP_ENCRYPTION_KEY` (32-byte). Must be injected in `.env`, docker-compose, CI secrets. Migration must run on deploy. | No new npm dep, but new **config dependency** |

**Count of modules impacted: 6** (5 are strictly code modules across 3 layers + frontend; #6 is the config/ops surface). If counting only code libs/apps that must be edited: **5** (`domain/admin`, `infrastructure/admin`, optional `infrastructure/auth`, `apps/api admin module`, `apps/web admin feature`).

### 3.2 Coupling analysis

- **Afferent / efferent (admin context):** `apps/api/.../admin` already depends on `@csn/domain-admin`, `@csn/infra-admin`, `@csn/domain-identity`, `@csn/infra-identity`, `@csn/infra-auth`, `@nestjs/jwt`. Adding `otplib` raises the admin module's efferent coupling by exactly **one external package**, isolated to two command handlers — **low, localized coupling**.
- **Encryption coupling:** the AES `EncryptionService` introduces a new internal dependency. Placing it in `infra-admin` keeps it private to the context (lower reuse, higher duplication risk if other contexts later need encryption). Placing it in `infra-auth` increases shared coupling but follows DRY. Recommend `infra-auth` since it already owns key material handling.
- **Domain purity:** the new `TotpSecret` value object and repository interface must stay in `domain-admin` with **no** dependency on `otplib` or `crypto` — verification/encryption belong in infra/application. This preserves the hexagonal boundary.

### 3.3 Circular-dependency risk — LOW (verified)

Grep checks confirm a clean acyclic direction:

- `libs/domain/identity` and `libs/infrastructure/identity` contain **no** import of any `@csn/*admin` package → identity does not depend on admin.
- `libs/domain/admin` and `libs/infrastructure/admin` contain **no** import of `@csn/domain-identity` / `@csn/infra-identity` → the admin **domain/infra libs are clean** of identity.
- The only admin→identity coupling lives in the **application layer** (`apps/api/.../admin` handlers import `@csn/domain-identity` + `@csn/infra-identity`), which is the correct place for cross-context orchestration.

**Conclusion:** introducing the TOTP secret store does **not** create a cycle, provided the encryption/verification logic stays out of the domain layer. The only way to introduce a cycle would be to (mistakenly) make `domain-admin` import `otplib`/`crypto` or make `infra-identity` reach back into `infra-admin`. Guard against this in code review / nx module-boundary lint.

---

## 4. `overrides` Pinning — vuln patches ARE pinned via overrides: **YES (fragility/maintenance risk)**

Commit `3e29a02 chore(deps): patch dependabot vulnerabilities via overrides` is reflected in `package.json`. There **is** an `overrides` section (lines 88–105) with **15 forced transitive resolutions**:

```
brace-expansion ^2.0.2   esbuild ^0.25.0      lodash ^4.18.1        minimatch ^9.0.5
multer ^2.0.3            picomatch ^4.0.4     tar ^7.5.0            uuid ^11.1.0
yaml ^2.4.2             ajv ^8.17.1          js-yaml ^4.1.1        file-type ^21.0.0
flatted ^3.3.4          rollup ^4.50.2       socket.io-parser ^4.2.5  svgo ^3.3.2
```

### Risk assessment of the overrides strategy

- **Yes, vuln patches are pinned via `overrides`** rather than by upgrading the direct dependencies that pull these transitives. This is a known **fragility/maintenance risk**:
  - **Silent drift / breakage:** `overrides` force-resolve a version a parent package did not declare compatibility with (e.g., `multer ^2.0.3` overriding what `@nestjs/platform-express` expects; `esbuild ^0.25.0`, `rollup ^4.50.2` under `vite`/nx). A future legitimate upgrade can conflict and break the build — note the project already had a "build on first app start" issue (commit `fe8ec18`).
  - **Suspicious entry:** `lodash ^4.18.1` is **not a real published lodash version** (lodash stops at 4.17.x). This override likely does nothing useful / may resolve unexpectedly — flag for correction. The intended fix is almost certainly `^4.17.21` (CVE-2021-23337 prototype pollution).
  - **No root cause fix:** overrides mask the vulnerability without updating the offending direct dependency, so the warnings reappear whenever lockfiles are regenerated or deps bump.
  - **TOTP relevance:** adding `otplib` (pure JS, tiny transitive tree) is **unlikely to collide** with these overrides, but every new install regenerates `package-lock.json` and re-applies all 15 overrides — increasing the chance one of them (esp. `esbuild`/`rollup`/`multer`) surfaces a resolution conflict during the TOTP PR's CI build.

**Verdict: overrides-pinning risk = YES.** Recommend tracking a follow-up to replace overrides with proper direct-dependency upgrades, and fix the bogus `lodash ^4.18.1` entry.

---

## 5. Concrete Dependency-Risk Findings

| ID | Risk | Severity | Notes |
|---|---|---|---|
| R1 | **`overrides`-pinned vuln patches** (15 forced resolutions) create build-fragility & re-applied on every install incl. the TOTP PR | High | Section 4. `lodash ^4.18.1` is a non-existent version — broken override. |
| R2 | **No encryption primitive exists** today; an AES-256-GCM `EncryptionService` + a 32-byte `TOTP_ENCRYPTION_KEY` must be added and key-managed | High | Storing TOTP secrets unencrypted, or with a weak/hardcoded key (cf. `admin-jwt-secret-change-me` default in `admin.module.ts`), would defeat the feature's purpose. |
| R3 | **2FA is currently a stub** — `setup`/`verify`/`login` accept any 6-digit code (`/^\d{6}$/`) and `admin-login` hardcodes `requiresTwoFactor: false` | High | Real verification must replace the format-only check; otherwise 2FA is security theater. |
| R4 | **Encryption service placement** (`infra-admin` vs `infra-auth`) is an architecture decision affecting reuse/coupling | Medium | Recommend `infra-auth`. Wrong placement risks duplication or boundary violations. |
| R5 | **New external dep `otplib`** must be added to dependencies and lockfile; transitive tree small but install regenerates lockfile → re-applies overrides (couples to R1) | Medium | Pure JS, no native build — does not worsen the Docker first-start build problem. |
| R6 | **QR generation dependency decision** (server `qrcode` vs client-side) | Low | Prefer client-side rendering of `otpauth://` URI to avoid a new server dep. |
| R7 | **Migration coupling** — a new `admin_totp_secrets` table migration must run before the feature works; ordering after `1710000006000` | Medium | Missing migration in deploy pipeline = runtime failure on verify. |
| R8 | **Throttling not wired to TOTP verify** — brute-forcing a 6-digit code is feasible without rate limiting | Medium | `@nestjs/throttler` is already a dependency; apply it to the verify endpoint. |

---

## 6. Test Ideas (dependency-driven)

1. **Library smoke / contract test (`otplib`):** generate a secret, derive a token with a fixed time, assert `authenticator.verify` accepts it within the window and rejects an off-window/expired token. Locks the dependency's behavior so a future version bump can't silently break verification.
2. **Encrypted store round-trip:** store a TOTP secret via the new repo, read raw DB column → assert it is **ciphertext (not plaintext base32)**; decrypt → assert equals original. Covers R2.
3. **Wrong / missing `TOTP_ENCRYPTION_KEY`:** assert startup or decrypt fails loudly (no silent fallback to a default key). Covers R2/the `change-me` anti-pattern.
4. **Real verify replaces stub:** assert a syntactically valid but cryptographically wrong 6-digit code is **rejected** (currently it would pass). Regression guard for R3.
5. **`requiresTwoFactor` gating:** admin with an enrolled secret → `admin-login` returns `requiresTwoFactor: true` and does NOT issue a full-privilege token until verify succeeds. Covers R3.
6. **Brute-force / throttling:** N rapid invalid verify attempts → throttled (429). Covers R8.
7. **Replay protection:** the same valid TOTP token used twice in the same step window is rejected on the second use (if step-reuse prevention is in scope).
8. **nx module-boundary lint test:** assert `domain-admin` does **not** import `otplib`/`crypto`, and `infra-identity` does **not** import `@csn/*admin` — automated guard against the circular-dependency risk (Section 3.3).
9. **Build/lockfile integration:** after adding `otplib`, run install + `nx build api`/`build:web` in CI to confirm the 15 `overrides` (esp. `esbuild`/`rollup`/`multer`) still resolve and the first-start build is not broken. Covers R1/R5.
10. **Migration test:** apply `admin_totp_secrets` migration on a clean DB, assert table/columns exist and unique constraint on admin id. Covers R7.

---

## 7. Summary

- **TOTP library recommendation:** `otplib@^12.0.1` (reject `speakeasy` — unmaintained). No native build; small transitive footprint.
- **Encryption:** satisfiable with Node stdlib `crypto` (AES-256-GCM) — **no new npm dep**; place the `EncryptionService` in `infra-auth`.
- **Modules impacted:** **6** (`libs/domain/admin`, `libs/infrastructure/admin`, optional `libs/infrastructure/auth`, `apps/api` admin module, `apps/web` admin feature, plus config/ops env+migration surface). 5 code modules across 3 DDD layers.
- **Circular-dependency risk:** LOW / none — admin and identity libs are acyclic; keep `otplib`/`crypto` out of the domain layer.
- **overrides-pinning risk:** **YES** — 15 forced transitive resolutions (incl. a broken `lodash ^4.18.1`), a fragility/maintenance liability re-applied on every install.
- **Top risks:** R1 overrides fragility, R2 missing encryption primitive + key management, R3 stubbed 2FA accepting any 6-digit code.
