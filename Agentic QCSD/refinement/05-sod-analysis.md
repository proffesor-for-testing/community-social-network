# 05 — Segregation of Duties / Authorization Analysis (Admin Context)

**Refinement subject:** Admin authentication, roles, and privilege boundaries
**Flag:** HAS_AUTHORIZATION=TRUE
**Analyzer:** SoD / Authorization Analyzer (QCSD Refinement swarm)
**Scope read:** `apps/api/src/modules/admin/{controllers,commands,queries,guards}`, `libs/domain/admin`, `libs/infrastructure/admin`, plus `libs/infrastructure/auth/jwt.service.ts` and `libs/domain/identity` (role provenance trace).

---

## 1. Role Model — what exists and how it is (not) assigned

### 1.1 Declared roles
`libs/domain/admin/src/value-objects/admin-role.ts`:
```
enum AdminRole { SUPER_ADMIN, ADMIN, MODERATOR }
```
This is the ONLY role taxonomy in the admin context. It implies a three-tier privilege model (super-admin > admin > moderator).

### 1.2 The taxonomy is decorative — it is never used for authorization
- `AdminRole` is referenced in exactly one place outside its own definition: `verify-2fa.handler.ts:65`, where it is written as a **hardcoded literal** `role: AdminRole.ADMIN` into a 2FA token payload. It is never compared, never branched on, never persisted.
- `SUPER_ADMIN` and `MODERATOR` are **dead enum members** — grep across `apps/` and `libs/` shows zero consumers in the admin context. There is no super-admin vs admin distinction enforced anywhere.
- The runtime authorization token uses an **entirely different, unrelated role vocabulary**: the login handler mints the string `'admin'` (lowercase) in a `roles: string[]` array (`admin-login.handler.ts:95`), and the guard checks `payload.roles.includes('admin')` (`admin-auth.guard.ts:37`). `AdminRole` (the domain enum) and `'admin'` (the token string) are two disconnected systems. The domain model has no bearing on what the guard enforces.

### 1.3 Role provenance — where does 'admin' come from at login?
**Nowhere legitimate.** This is the root defect.
- `admin-login.handler.ts:37-96`: the handler loads a `member` by email, `bcrypt.compare`s the password, checks `member.status === 'ACTIVE'`, and then unconditionally mints `roles: ['admin','member']`.
- There is **no admin-membership check** between password validation and token minting. The code comment at lines 52-54 openly admits it: *"In a full implementation, admin role would be verified from a separate admin table or role field on the member."* That verification was never implemented.
- Confirmed by tracing the identity domain: the `Member` aggregate has **no `isAdmin` flag, no role field, and no grant mechanism**. Grep for `isAdmin|grantRole|assignRole|SUPER_ADMIN|promote` across `libs/domain/identity` returns nothing. (`MembershipRole` in `libs/domain/community` is a *community*-scoped concept — per-community moderation — and is unrelated to platform admin.)

**Conclusion:** Admin privilege is granted on the basis of "knows any valid member's password," not on the basis of being an admin. There is no role assignment, no role store, and no privilege separation. Anyone with any active member account is a platform admin.

---

## 2. Privilege-Escalation Paths (enumerated)

> A "path" below is a distinct way a non-admin or partially-authenticated caller reaches admin-only capability (suspend/unsuspend users, read full user list, read audit log, read security alerts).

### PE-1 — Any active member → full admin via the admin login endpoint *(CRITICAL, primary)*
- `POST /api/admin/auth/login` is `@Public()` (`admin-auth.controller.ts:25`) and routes to `AdminLoginHandler`.
- The handler authenticates **any** member by email+password and mints `['admin','member']` with **no admin check** (`admin-login.handler.ts:55-96`).
- The resulting token passes `AdminAuthGuard` because it contains `'admin'` in `roles`.
- **Result:** every registered, active, non-admin user can log in here and receive a fully-privileged admin token. No special account, no allow-list, no flag required.

### PE-2 — Full admin privilege granted *before* 2FA *(CRITICAL)*
- The token from PE-1 is already a working admin token (`roles:['admin']`), and `AdminLoginResult.requiresTwoFactor` is hardcoded `false` (`admin-login.handler.ts:100`).
- The 2FA flow is **decorative and non-blocking**: nothing forces a caller to complete it. The login token alone opens every admin route.
- **Result:** 2FA is a no-op gate; password-only auth yields full admin. (See also SoD §3.)

### PE-3 — Guard hardcodes `twoFactorVerified:false` and never enforces it *(HIGH)*
- `admin-auth.guard.ts:45` sets `twoFactorVerified: false` on the request principal and **never reads it**. No route, handler, or guard checks this flag.
- Even if 2FA were wired up, the guard does not require a 2FA-verified token to reach admin routes — it only checks `roles.includes('admin')`.
- **Result:** there is no enforcement point that distinguishes a pre-2FA token from a post-2FA token. The step-up control is structurally absent.

### PE-4 — `x-admin-id` header lets the caller assert which identity 2FA is minted for *(HIGH — identity spoofing / impersonation)*
- `admin-auth.controller.ts:52`: `const adminId = req.headers['x-admin-id'] as string;` — the verify-2fa endpoint reads the subject identity from a **client-supplied header**, not from a server-side session.
- `verify-2fa.handler.ts:39` accepts **any syntactically valid 6-digit code** (`/^\d{6}$/`) — the TOTP check is a TODO (line 52). It then mints a token with `sub = adminId` (attacker-chosen) and `twoFactorVerified:true`.
- **Result:** a caller can mint a "2FA-verified" admin token for an arbitrary `adminId` of their choosing, with a guessed/throwaway 6-digit string. This is both impersonation (act as any admin id in audit logs) and a second standalone path to an admin-typed token. Note this token uses a different shape (`role`, `type:'admin'`) — its acceptance depends on whichever guard consumes it, but it is independently forgeable.

### PE-5 — No mid-session / per-request role re-validation *(MEDIUM, amplifier)*
- `AdminAuthGuard` trusts the JWT `roles` claim for the full token lifetime; it never re-checks the user's current admin status against a source of truth (because none exists).
- Combined with PE-1, a member who is later "demoted" (no mechanism exists, but conceptually) or whose account is disabled keeps admin until token expiry. The token is the sole authority.
- **Result:** privilege cannot be revoked mid-session except by blacklisting the specific jti; there is no role-state check.

**Total distinct privilege-escalation paths: 5** (PE-1 and PE-4 are independent ways to obtain an admin token; PE-2, PE-3, PE-5 remove the controls that would otherwise contain them).

---

## 3. Segregation-of-Duties Conflicts

### SoD-1 — Self-granting of privilege: the actor who authenticates also self-issues the elevated role *(CRITICAL)*
Classic SoD requires that the party who *requests/uses* a privilege is not the party who *grants* it. Here:
- The same request (`POST /admin/auth/login`) both **authenticates the actor** and **grants the actor the `admin` role**, with no second control, no approver, and no pre-existing admin designation.
- There is no "who can grant admin" actor at all — grant is implicit in login. A would-be admin grants themselves admin by logging in. This is the canonical *create-and-use-elevated-privilege-without-a-second-control* SoD violation.

### SoD-2 — No separation between super-admin (grantor) and admin (operator)
- The enum implies SUPER_ADMIN should be the privilege-granting tier and ADMIN the operating tier. In practice neither is enforced; there is no super-admin gate on any sensitive operation and no concept of "only super-admin may create admins." The intended two-control separation collapses into a single self-service tier.

### SoD-3 — Operator and audited-party overlap; audit can be attributed to a spoofable identity *(HIGH)*
- Sensitive operations (`suspend`/`unsuspend`) record `performedBy = command.adminId`, which comes from the token (`suspend-user.handler.ts:52`). For PE-4-minted tokens the `adminId` is attacker-chosen, so the **audit trail can be forged to point at an innocent admin** or a bogus id. The party performing the action controls the identity recorded against it — destroying the integrity/non-repudiation property the audit log exists to provide.
- There is **no approval separation** on destructive actions: a single admin token can suspend any user with no second sign-off, no maker/checker, and (per SoD-1) that token was self-granted.

### SoD-4 — No segregation between authentication issuer and 2FA issuer
- Login mints admin tokens (`JwtTokenService`, canonical signing key) while verify-2fa mints a *different* admin-typed token via `JwtService.sign` with a different payload shape (`verify-2fa.handler.ts:63-70`). Two independent token-minting authorities exist with no shared policy. Neither requires the other to have run.

---

## 4. Missing Access Controls (summary)

| Control | Status | Evidence |
|---|---|---|
| Admin-membership check at login (role provenance) | **MISSING** | `admin-login.handler.ts:52-96` — comment admits it, code mints `'admin'` unconditionally |
| Persistent admin role / allow-list store | **MISSING** | No role field on `Member`; `AdminRole` enum never persisted |
| Super-admin vs admin privilege separation | **MISSING** | `SUPER_ADMIN`/`MODERATOR` are dead enum members |
| 2FA enforced before admin capability (step-up) | **MISSING** | `requiresTwoFactor:false` hardcoded; guard ignores `twoFactorVerified` |
| `twoFactorVerified` enforcement in guard | **MISSING** | `admin-auth.guard.ts:45` sets it false, never reads it |
| Server-side session binding of 2FA subject | **MISSING** | `x-admin-id` header is client-supplied (`admin-auth.controller.ts:52`) |
| Real TOTP verification | **MISSING (TODO)** | `verify-2fa.handler.ts:39,52` accepts any 6-digit string |
| Mid-session / per-request role re-validation | **MISSING** | Guard trusts JWT `roles` claim only |
| Least privilege (scoped roles) | **MISSING** | Single coarse `'admin'` grants every admin route incl. user suspension |
| Maker/checker or approval on destructive ops | **MISSING** | `suspend`/`unsuspend` execute on a single self-granted token |
| Audit identity integrity (non-repudiation) | **BROKEN** | `performedBy` sourced from spoofable token id |

---

## 5. Concrete Authorization Test Ideas (active voice)

**Privilege-escalation / role provenance**
1. Register a brand-new ordinary member, then POST that member's email+password to `/api/admin/auth/login`; assert the response is rejected (no token, 401/403) rather than returning a token containing `roles:['admin']`.
2. Decode the access token minted by `/api/admin/auth/login` for a non-admin member and assert its `roles` array does NOT contain `'admin'`.
3. Call `GET /api/admin/users` with a token minted from a non-admin member's login and assert the request returns 403 (proves the admin route is unreachable without a real admin grant).
4. Suspend a victim user using a non-admin-derived admin token and assert the suspension is refused.

**2FA step-up enforcement**
5. Log in as a real admin (no 2FA completed), call `PUT /api/admin/users/:id/suspend` with the login token, and assert the call is rejected for missing 2FA (step-up required) rather than succeeding.
6. Decode the login result and assert `requiresTwoFactor` is `true` whenever the admin account has 2FA enabled.
7. Submit a request to an admin route carrying a token whose `twoFactorVerified` is `false` and assert the guard rejects it.

**x-admin-id spoofing / impersonation**
8. POST `/api/admin/auth/verify-2fa` with header `x-admin-id` set to a different admin's id and code `000000`; assert the endpoint rejects the request (does not mint a token for the asserted identity).
9. Drive the 2FA verify flow and assert the minted token's `sub` equals the server-side session subject established at login, NOT the value of the `x-admin-id` request header.
10. Submit twelve sequential 6-digit codes (`000000`..`000011`) to `/verify-2fa` and assert all are rejected (proves real TOTP validation, not format-only acceptance).

**SoD / audit integrity**
11. Suspend a user, then read `GET /api/admin/audit-log` and assert the `performedBy` matches the cryptographically-verified token subject and cannot be overridden by a client-supplied header.
12. Attempt a destructive op (suspend) with a moderator-tier identity and assert it is refused unless an admin/super-admin tier is present (proves tiered least-privilege once roles are wired).
13. Mint a token via the `/verify-2fa` path and replay it against `/api/admin/users`; assert the `AdminAuthGuard` consistently validates it under the same policy as login tokens (proves single token-issuance authority, closes SoD-4).

**Mid-session re-validation**
14. Obtain an admin token, revoke/disable the admin account server-side, then reuse the token against an admin route and assert it is now rejected (proves per-request role re-check rather than blind trust of the JWT claim).
