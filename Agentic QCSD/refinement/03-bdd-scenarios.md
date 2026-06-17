# BDD Scenarios — Admin TOTP 2FA + Session Binding

**Refinement subject**
> As a platform operator, admin login must require real TOTP-based 2FA and bind admin identity to a server-issued session, so that obtaining admin credentials alone is NOT sufficient to gain admin access.

**Phase:** QCSD Refinement
**Generated:** 2026-06-16
**Source of truth (read today):** `apps/api/src/modules/admin/`

---

## Concrete endpoints & contracts (as they exist today)

| Endpoint | Handler | Auth | DTO / Inputs |
|----------|---------|------|--------------|
| `POST /api/admin/auth/login` | `AdminLoginHandler` | `@Public()` | `AdminLoginDto { email, password }` |
| `POST /api/admin/auth/verify-2fa` | `Verify2faHandler` | none (reads `x-admin-id` header) | `Verify2faDto { code: 6 digits }` + header `x-admin-id` |
| `POST /api/admin/2fa/setup` | `Setup2faHandler` | `AdminAuthGuard` (Bearer) | `Setup2faDto { code: 6 digits }` |
| `POST /api/admin/2fa/verify` | `Verify2faHandler` | `AdminAuthGuard` (Bearer) | `Verify2faDto { code }` |
| `GET /api/admin/users`, `PUT /api/admin/users/:id/suspend`, `GET /api/admin/audit-log`, ... | various | `AdminAuthGuard` | privileged admin actions |

**Token shape minted today**
- `AdminLoginHandler` (login) → `JwtTokenService.generateAccessToken({ roles: ['admin','member'] })` — a FULL admin token, issued *before any 2FA*, with `requiresTwoFactor: false` (line 100).
- `Verify2faHandler` (verify-2fa) → `jwtService.sign({ sub: adminId, role: ADMIN, type: 'admin', twoFactorVerified: true }, 15m)`.

**Observed defects driving these scenarios**
- D1 `verify-2fa.handler.ts:39-53` — accepts ANY code matching `/^\d{6}$/`. No TOTP, no secret, no time window, no replay/reuse protection. (TODO stub)
- D2 `admin-auth.controller.ts:52` — `adminId = req.headers['x-admin-id']`. Client-supplied identity, no session binding → identity spoofing / privilege escalation.
- D3 `admin-login.handler.ts:100` — returns `requiresTwoFactor: false` and mints a full admin token at login. Password alone already grants admin access; 2FA is not on the critical path.
- D4 `setup-2fa.handler.ts:34-38` — TODO stub. No secret generated, encrypted, or stored; returns `{ enabled: true }` unconditionally for any 6-digit code.
- D5 `admin-auth.guard.ts:45` — hardcodes `twoFactorVerified: false` and never enforces it on privileged routes.

---

## Target behaviour (acceptance baseline for these scenarios)

These scenarios are written against the **intended** secure design so they are executable and observable after implementation:

1. **Login → pre-2FA challenge token** (short-lived, scope `2fa-pending`, NOT accepted by `AdminAuthGuard`), `requiresTwoFactor: true`.
2. **Enrollment** generates a server-side TOTP secret (encrypted at rest), returns provisioning URI / QR once, and is confirmed by a valid code before being marked active.
3. **verify-2fa** binds identity to the **server-issued pre-2FA token** (NOT `x-admin-id`), verifies the submitted code against the stored secret using RFC 6238 (30s step, ±1 window), enforces single-use-per-step (replay rejection), and only then mints the full admin session token.
4. Privileged routes require a token where `twoFactorVerified === true`.

Tags: `@happy`, `@security`, `@edge`, `@regression-fails-today`, `@smoke`, `@boundary`.

---

## Feature 1 — Admin TOTP Enrollment

```gherkin
Feature: Admin TOTP 2FA Enrollment
  As a platform operator
  I want to enroll a TOTP authenticator bound to my admin identity
  So that a server-stored secret exists to verify codes against

  Background:
    Given an admin account "admin@csn.example.com" exists with status "ACTIVE"
    And the admin has authenticated with a valid password
    And the admin holds a valid admin session token

  @happy @smoke
  Scenario: Begin enrollment returns a server-generated secret and provisioning URI
    When the admin requests "POST /api/admin/2fa/setup" to begin enrollment
    Then the response status is 200
    And the response contains a one-time "otpauthUri" of form "otpauth://totp/CSN:admin@csn.example.com?secret=...&issuer=CSN"
    And a TOTP secret is persisted server-side associated with this admin id
    And the stored secret is encrypted at rest (not plaintext)
    And the 2FA status for the admin is "PENDING_CONFIRMATION"
    And an audit entry "ADMIN_2FA_SETUP" is written with the admin id and IP

  @happy
  Scenario: Confirm enrollment with a correct TOTP code activates 2FA
    Given the admin has a "PENDING_CONFIRMATION" TOTP secret "S1"
    And the current valid TOTP for secret "S1" is "<currentCode>"
    When the admin submits "POST /api/admin/2fa/setup" with body { "code": "<currentCode>" }
    Then the response status is 200
    And the response body is { "enabled": true, "message": "Two-factor authentication has been enabled" }
    And the 2FA status for the admin becomes "ACTIVE"

  @security @regression-fails-today
  Scenario: Enrollment cannot be confirmed without a stored secret
    Given no TOTP secret has been generated for the admin
    When the admin submits "POST /api/admin/2fa/setup" with body { "code": "123456" }
    Then the response status is 400 or 409
    And the response indicates no enrollment is in progress
    And the 2FA status for the admin remains "NONE"
    # TODAY: setup-2fa.handler.ts:34-38 returns { enabled: true } for ANY 6-digit code with no secter -> FAILS

  @security
  Scenario: A wrong code during confirmation does not activate 2FA
    Given the admin has a "PENDING_CONFIRMATION" TOTP secret "S1"
    And "000000" is NOT the current valid TOTP for secret "S1"
    When the admin submits "POST /api/admin/2fa/setup" with body { "code": "000000" }
    Then the response status is 401
    And the 2FA status for the admin remains "PENDING_CONFIRMATION"

  @boundary
  Scenario Outline: Setup rejects malformed codes at the DTO boundary
    When the admin submits "POST /api/admin/2fa/setup" with body { "code": "<code>" }
    Then the response status is <status>

    Examples:
      | code    | status | note                       |
      | 12345   | 400    | too short (Length 6,6)     |
      | 1234567 | 400    | too long                   |
      | abcdef  | 400    | non-numeric (after TOTP)   |
      | (empty) | 400    | missing                    |
```

---

## Feature 2 — Login Issues a Pre-2FA Challenge (not full access)

```gherkin
Feature: Admin Login Issues a 2FA Challenge
  As a platform operator
  I want password login to yield only a short-lived 2FA-pending token
  So that credentials alone never grant admin access

  Background:
    Given an admin "admin@csn.example.com" exists with status "ACTIVE" and 2FA "ACTIVE"

  @happy @smoke
  Scenario: Valid credentials return a 2FA challenge, not an admin session
    When a client calls "POST /api/admin/auth/login" with valid email and password
    Then the response status is 200
    And the response field "requiresTwoFactor" is true
    And the returned token has scope "2fa-pending" and TTL <= 5 minutes
    And the returned token is REJECTED by AdminAuthGuard on "GET /api/admin/users" with status 401
    And an audit entry "ADMIN_LOGIN_SUCCESS" is written

  @security @regression-fails-today
  Scenario: Credentials alone cannot reach a privileged admin route
    Given a valid email and password for the admin
    When the client logs in and uses the returned token on "PUT /api/admin/users/{victimId}/suspend"
    Then the request is rejected with status 401
    And the victim user status is unchanged
    # TODAY: admin-login.handler.ts:92-100 mints roles:['admin','member'] full token at login (requiresTwoFactor:false) -> the suspend SUCCEEDS -> FAILS

  @security
  Scenario: Invalid password never issues any token
    When a client calls "POST /api/admin/auth/login" with a wrong password
    Then the response status is 401
    And no token of any scope is returned
    And an audit entry "ADMIN_LOGIN_FAILED" with reason "Invalid password" is written

  @security
  Scenario: Non-active admin account is denied at login
    Given the admin account status is "SUSPENDED"
    When a client calls "POST /api/admin/auth/login" with otherwise valid credentials
    Then the response status is 403
    And no token is returned
```

---

## Feature 3 — TOTP Verification Bound to Server Session (Happy Path)

```gherkin
Feature: Admin 2FA Verification
  As a platform operator
  I want the 2FA step to verify a real TOTP code bound to my server-issued session
  So that the full admin token is only minted after proven possession of the authenticator

  Background:
    Given an admin "admin@csn.example.com" with 2FA "ACTIVE" and stored secret "S1"
    And the admin has logged in and holds a "2fa-pending" token "PT" bound to this admin id

  @happy @smoke
  Scenario: Correct current TOTP code mints the full admin session token
    Given "<currentCode>" is the current valid TOTP for secret "S1"
    When the admin calls "POST /api/admin/auth/verify-2fa" with token "PT" and body { "code": "<currentCode>" }
    Then the response status is 200
    And the response contains "accessToken" with claim twoFactorVerified=true and role admin
    And that access token is ACCEPTED by AdminAuthGuard on "GET /api/admin/users" (status 200)
    And an audit entry "ADMIN_2FA_VERIFY_SUCCESS" is written for this admin id

  @happy
  Scenario: The verified admin token authorizes a privileged action
    Given the admin completed 2FA and holds a verified admin token
    When the admin calls "PUT /api/admin/users/{targetId}/suspend"
    Then the response status is 200
    And the target user becomes "SUSPENDED"
    And an audit entry attributes the action to the real admin id from the session (not a header)
```

---

## Feature 4 — Security & Negative Scenarios

```gherkin
Feature: Admin 2FA Security Controls
  As a platform operator
  I want incorrect, replayed, expired, forged, and brute-forced 2FA attempts rejected
  So that admin access requires genuine possession of the authenticator

  Background:
    Given an admin "admin@csn.example.com" with 2FA "ACTIVE" and stored secret "S1"
    And the admin holds a valid "2fa-pending" token "PT" bound to this admin id

  @security @regression-fails-today
  Scenario: A wrong 6-digit code is rejected
    Given "111111" is NOT a valid TOTP for secret "S1" in the current or adjacent windows
    When the admin calls "POST /api/admin/auth/verify-2fa" with token "PT" and body { "code": "111111" }
    Then the response status is 401
    And no admin access token is issued
    And an audit entry "ADMIN_2FA_VERIFY_FAILED" is written
    # TODAY: verify-2fa.handler.ts:39-53 accepts ANY /^\d{6}$/ code and issues a 15m admin token -> FAILS

  @security @regression-fails-today
  Scenario: A previously used (replayed) valid code is rejected
    Given the admin successfully verified with code "<currentCode>" moments ago
    And the same TOTP time-step is still active
    When the admin calls "POST /api/admin/auth/verify-2fa" again with token "PT" and body { "code": "<currentCode>" }
    Then the response status is 401
    And the response indicates the code was already used
    And no new admin token is issued
    # TODAY: no per-step single-use tracking exists -> the replay SUCCEEDS -> FAILS

  @security @regression-fails-today
  Scenario: A code from an already-expired time window is rejected
    Given "<oldCode>" was valid 5 minutes ago but is outside the accepted window now
    When the admin calls "POST /api/admin/auth/verify-2fa" with token "PT" and body { "code": "<oldCode>" }
    Then the response status is 401
    And no admin token is issued
    # TODAY: any 6-digit code is accepted regardless of time -> FAILS

  @security @regression-fails-today
  Scenario: Identity is taken from the server session, NOT the x-admin-id header
    Given a low-privilege attacker holds no valid admin session
    When the attacker calls "POST /api/admin/auth/verify-2fa" with header "x-admin-id: <realAdminId>" and body { "code": "654321" }
    Then the response status is 401
    And no admin token is minted for "<realAdminId>"
    # TODAY: admin-auth.controller.ts:52 trusts x-admin-id and verify accepts any 6-digit code -> attacker gets a 15m admin token for realAdminId -> FAILS (privilege escalation)

  @security @regression-fails-today
  Scenario: Swapped admin identity — code valid for admin A cannot authenticate as admin B
    Given admin A has secret "SA" and admin B has secret "SB"
    And "<codeForA>" is the current valid TOTP for "SA"
    And the caller holds a "2fa-pending" token bound to admin B
    When the caller calls "POST /api/admin/auth/verify-2fa" with that token and body { "code": "<codeForA>" }
    Then the response status is 401
    And no admin token is issued for admin B
    # TODAY: identity comes from x-admin-id and code is never matched to a secret -> can mint a token for B -> FAILS

  @security @regression-fails-today
  Scenario: Pre-2FA token cannot be reused to skip verification
    Given the admin used token "PT" to complete one 2FA verification
    When the admin calls "POST /api/admin/auth/verify-2fa" again with the same "PT"
    Then the response status is 401
    And the pre-2FA token is single-use and now invalid
    # TODAY: no pre-2FA token concept exists; verify accepts header + any code repeatedly -> FAILS

  @security @regression-fails-today
  Scenario Outline: Brute-force lockout after repeated wrong codes
    Given the admin has submitted <priorFailures> consecutive invalid codes
    When the admin submits another invalid code
    Then the response status is <status>
    And the response message is "<message>"

    Examples:
      | priorFailures | status | message                          |
      | 2             | 401    | Invalid 2FA code                 |
      | 4             | 401    | Invalid 2FA code (1 attempt left)|
      | 5             | 429    | 2FA locked for 15 minutes        |
    # TODAY: no attempt counter / lockout exists, and codes are accepted anyway -> FAILS

  @security
  Scenario: verify-2fa without a valid pre-2FA session is rejected
    When a client calls "POST /api/admin/auth/verify-2fa" with no token and no header and body { "code": "123456" }
    Then the response status is 401
    And no admin token is issued
    # TODAY: missing x-admin-id => adminId is undefined; UserId.create(undefined) likely throws/500, and a present header would succeed -> FAILS

  @security
  Scenario: A pre-2FA token is not accepted on privileged routes
    Given the admin holds only a "2fa-pending" token "PT"
    When the admin calls "GET /api/admin/audit-log" with "PT"
    Then the response status is 401
```

---

## Feature 5 — Edge Cases (clock skew, window reuse, concurrency)

```gherkin
Feature: Admin 2FA Edge Conditions
  As a platform operator
  I want TOTP verification to tolerate small clock skew but stay strict on reuse and concurrency
  So that legitimate admins succeed while attacks are blocked

  Background:
    Given an admin "admin@csn.example.com" with 2FA "ACTIVE" and stored secret "S1"
    And the TOTP step is 30 seconds and the accepted drift window is +/-1 step

  @edge @boundary
  Scenario Outline: Codes within the allowed clock-skew window are accepted
    Given the authenticator clock is offset by <offsetSeconds> seconds from the server
    And "<code>" is the TOTP computed at the offset time
    And the admin holds a valid "2fa-pending" token
    When the admin calls "POST /api/admin/auth/verify-2fa" with body { "code": "<code>" }
    Then the response status is <status>

    Examples:
      | offsetSeconds | status | note                                  |
      | 0             | 200    | exact current step                    |
      | -29           | 200    | previous step within -1 window        |
      | +29           | 200    | next step within +1 window            |
      | -60           | 401    | two steps back, outside window        |
      | +60           | 401    | two steps forward, outside window     |

  @edge @security
  Scenario: A code already accepted in a window cannot be reused within the SAME window
    Given the admin verified successfully with "<currentCode>" at time T
    And the current time is still within the same 30-second step
    And the admin obtains a fresh "2fa-pending" token
    When the admin calls "POST /api/admin/auth/verify-2fa" with body { "code": "<currentCode>" }
    Then the response status is 401
    And the response indicates the code was already consumed for this step

  @edge
  Scenario: A new code from the next window is accepted after step rollover
    Given the admin verified with the code for step N
    And the clock advances into step N+1
    And the admin holds a fresh "2fa-pending" token
    And "<nextCode>" is the TOTP for step N+1
    When the admin calls "POST /api/admin/auth/verify-2fa" with body { "code": "<nextCode>" }
    Then the response status is 200

  @edge @security
  Scenario: Concurrent verify requests with the same code yield exactly one success
    Given the admin holds two independent "2fa-pending" sessions in the same time step
    And "<currentCode>" is the current valid TOTP
    When both sessions call "POST /api/admin/auth/verify-2fa" with { "code": "<currentCode>" } simultaneously
    Then exactly one request returns 200 with an admin token
    And the other request returns 401 (code already consumed)

  @edge
  Scenario: Multiple verified admin sessions can coexist (independent tokens)
    Given the admin completed 2FA from two different devices using two different valid time-step codes
    Then both devices hold distinct valid admin access tokens
    And revoking one device's token does not invalidate the other

  @edge @security
  Scenario: An expired pre-2FA token forces re-login
    Given the admin's "2fa-pending" token issued at login has exceeded its 5-minute TTL
    When the admin calls "POST /api/admin/auth/verify-2fa" with a currently-valid code
    Then the response status is 401
    And the response indicates the login session expired
    And the admin must re-authenticate with password
```

---

## Step Definition Mapping

| Step phrase | Reuse status | Target |
|-------------|--------------|--------|
| "an admin ... exists with status ..." | reusable | seed via member repository |
| "the admin holds a valid '2fa-pending' token" | NEW | requires pre-2FA token issuance (not yet implemented) |
| "the current valid TOTP for secret ... is ..." | NEW | TOTP helper (e.g. `otplib.authenticator.generate`) |
| "calls POST /api/admin/auth/verify-2fa with token ... and body ..." | partial | endpoint exists; token binding NEW |
| "is REJECTED/ACCEPTED by AdminAuthGuard" | reusable | drive any `@UseGuards(AdminAuthGuard)` route |
| "an audit entry '...' is written" | reusable | assert via `IAuditEntryRepository` / audit-log query |
| "the target user becomes SUSPENDED" | reusable | `suspend-user.handler` + member repository read |

New step definitions needed: TOTP code generation, pre-2FA token minting/binding, replay/lockout state assertions, clock-offset control.

---

## Summary

### Scenario count by category

| Category | Count |
|----------|-------|
| Happy path (enroll, login challenge, verify) | 7 |
| Negative / security | 15 |
| Edge (clock skew / window reuse / concurrency) | 9 |
| Boundary (DTO/code format) | 2 outlines (9 rows) |
| **Total scenarios (incl. outline rows)** | **~40** |

### Scenarios that the CURRENT stub implementation FAILS (security regressions)

Tagged `@regression-fails-today`:

1. **F1: Enrollment cannot be confirmed without a stored secret** — D4: `setup-2fa.handler.ts` returns `{enabled:true}` for any 6-digit code.
2. **F2: Credentials alone cannot reach a privileged admin route** — D3: login mints a full `['admin','member']` token immediately (`requiresTwoFactor:false`).
3. **F4: A wrong 6-digit code is rejected** — D1: `verify-2fa.handler.ts` accepts any `/^\d{6}$/`.
4. **F4: A previously used (replayed) valid code is rejected** — no single-use tracking.
5. **F4: A code from an expired time window is rejected** — no time/TOTP validation.
6. **F4: Identity from server session, NOT x-admin-id header** — D2: trusts `x-admin-id` → privilege escalation / impersonation.
7. **F4: Swapped admin identity (code for A can't auth as B)** — D2 + D1 combined.
8. **F4: Pre-2FA token cannot be reused to skip verification** — no pre-2FA token concept.
9. **F4: Brute-force lockout after repeated wrong codes** — no attempt counter/lockout.

The single most severe regression is **#6 (forged `x-admin-id`)** combined with **#3 (any 6-digit code accepted)**: an unauthenticated caller can POST `verify-2fa` with `x-admin-id: <any admin id>` and `code: "000000"` and receive a 15-minute admin token — full privilege escalation with NO credentials at all. **#2** is the structural root: real admin access is already granted at password login, so 2FA is entirely off the critical path.
