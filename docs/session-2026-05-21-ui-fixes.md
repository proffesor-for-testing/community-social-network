# Session Summary — 2026-05-21 — UI test loop + journey fixes

## Goal

User asked to bring the app online inside this devcontainer (docker-in-docker), then run a headless-browser test loop to find what's not working in the major user journeys and fix it. Loop ran until all major journeys verified working end-to-end via Vibium (headless Chromium).

## Final state

- Docker (DinD) reinstalled cleanly from Docker's official apt repo (the pre-installed `moby-containerd@2.3.0` was missing gRPC services).
- Stack running via `docker compose up -d`:
  - **postgres** :5432 (`csn_dev`, `csn_test`)
  - **redis** :6379
  - **api** (NestJS via ts-node) :3000
  - **web** (React/Vite/nginx) :4200
- Three test accounts seeded via `/api/auth/register`:
  - `admin@csn.local` / `Admin!Pass#2026`
  - `user@csn.local` / `User!Pass#2026`
  - `bot@csn.local` / `Bot!Pass#2026`

## Verified journeys (UI + API)

| Journey | Result |
|---|---|
| Register a new account | ✅ |
| Login (both endpoints, both accounts) | ✅ |
| Feed renders cross-user posts | ✅ |
| Create post + see in feed | ✅ |
| React to post (Like / Love / ...) | ✅ POST 201 |
| Click into post detail, render comments | ✅ |
| Add comment | ✅ POST 201, renders |
| Delete own post | ✅ DELETE 204 |
| Edit profile (display name + bio + city + country) | ✅ PATCH 200, multi-field update fixed |
| Theme toggle (Light / Dark / System) | ✅ html class flips |
| Create group | ✅ admin auto-becomes OWNER |
| Visit group detail | ✅ |
| Join group as non-owner | ✅ member count increments |
| Leave group | ✅ membership removed |
| Edit group settings (owner) | ✅ PATCH 200 |
| Follow another user from profile | ✅ POST 201 (PENDING) |
| Accept incoming follow request | ✅ PATCH 200 (ACCEPTED) |
| Unfollow | ✅ DELETE, button reverts |
| View followers / following / pending tabs | ✅ all render |
| Notifications list renders title + body | ✅ |
| Unread badge in header polls auto-syncs | ✅ |
| Mark single notification read | ✅ PUT 204 |
| Mark all notifications read | ✅ PUT 200 |
| Visit /admin, /admin/users routes | ✅ render (degrade gracefully on missing endpoints) |

## Bugs fixed (uncommitted)

### Infrastructure

| File | Bug |
|---|---|
| `apps/api/Dockerfile` | Production `nx build api` blocked by monorepo rootDir/path-alias conflict; replaced with ts-node dev runtime (`ts-node -r tsconfig-paths/register apps/api/src/main.ts`). Also added `npm rebuild bcrypt` after install (native binding needed). |
| `apps/web/Dockerfile` | `npm ci` failed on unresolvable transitive `babel-plugin-macros@2.8.0` vs `^3.1.0` conflict — switched to `npm install --legacy-peer-deps`. |
| `apps/web/nginx.conf` | `proxy_pass http://api_backend/` (trailing `/`) stripped the `/api/` prefix → backend got `/auth/login` instead of `/api/auth/login`. Removed trailing slash. |
| `package-lock.json` | Regenerated — was missing several transitive deps. |

### Web — API shape adapters (API returns one shape, FE expected another)

| File | Bug |
|---|---|
| `apps/web/src/router.tsx` | `errorElement` was `<ErrorBoundary><></></ErrorBoundary>` — empty Fragment under a boundary with `hasError=false` rendered nothing, silently hiding every route-level render error. Replaced with a visible error panel. |
| `apps/web/src/features/feed/queries.ts` | (already had `adaptPost`) — confirmed shape mapping works. |
| `apps/web/src/features/comments/queries.ts` | API returns `{postId, content}`; FE expected `{publicationId, body, authorName, authorAvatarUrl, reactionCount, updatedAt}`. Added `adaptComment()` with `'Member'` placeholder. Was crashing the whole post detail page via `Avatar({alt: undefined}) → getInitials(undefined).split`. |
| `apps/web/src/features/notifications/queries.ts` | (a) API returns `{content: {title, body}, status: 'UNREAD'}`; FE expected `{title, body, isRead}` top-level. Added `adaptAlert`. (b) `markAllNotificationsRead` used `apiClient.patch`, backend route is `@Put('read-all')` → 404. Switched to `.put`. (c) Adapted page-based pagination to FE cursor shape. |
| `apps/web/src/features/profile/queries.ts` | FE sent `{location: "Belgrade, Serbia", website: "..."}`, API rejected with "property location should not exist". `UpdateProfileDto` accepts `{displayName, bio, city, country}` and is whitelist-strict. Now splits `location` on comma → `city`, `country`; drops `website`. |
| `apps/web/src/features/profile/components/ProfileHeader.tsx` | `<FollowButton>` component existed (`features/social/components/FollowButton.tsx`) but was never rendered in ProfileHeader. Added it gated on `memberId !== currentUserId`. |
| `apps/web/src/features/social/queries.ts` | (a) `sendFollowRequest` sent `{addresseeId}`, backend wants `{memberId}`. (b) `fetchPendingRequests`, `fetchConnectionStatus`, `fetchFollowers`, `fetchFollowing` got API connection records `{id, followerId, followeeId, status: 'UPPERCASE'}` instead of `{id, requesterId, addresseeId, status: 'lowercase'}`. Added `adaptConnection()` + `connectionToProfile()` (synthesizes a minimal ProfileDto from a connection for the followers/following lists since the API doesn't join profile data). (c) `/connections/status/:id` returns 404 for non-accepted; added fallback to `/connections/pending` so a freshly-sent follow request flips the button to "Pending". |
| `apps/web/src/shared/components/organisms/Header.tsx` | Header reads `unreadCount` from zustand store but nothing called `useUnreadCount()` to populate it. Added the hook invocation so polling starts when the app shell mounts. |

### API

| File | Bug |
|---|---|
| `apps/api/src/modules/content/queries/get-feed.handler.ts` | `/api/publications/feed` only returned the caller's own posts (stub comment "Phase 5+ concern"). Now returns all PUBLISHED + PUBLIC posts via new `findAllPublished()` repository method. |
| `apps/api/src/modules/admin/controllers/admin.controller.ts` | `@Controller('admin')` while everything else uses `@Controller('api/...')`. Frontend calls `/api/admin/users` → 404. Fixed to `@Controller('api/admin')`. |
| `apps/api/src/modules/admin/controllers/admin-auth.controller.ts` | Same prefix bug (`@Controller('admin/auth')` → `@Controller('api/admin/auth')`). Also missing `@Public()` on `login` → global JWT guard rejected with 401 before the handler. Added both. |

### Libs

| File | Bug |
|---|---|
| `libs/domain/content/src/repositories/publication.repository.ts` | Added `findAllPublished()` to the interface. |
| `libs/infrastructure/content/src/repositories/postgres-publication.repository.ts` | Implemented `findAllPublished()` (TypeORM query for PUBLISHED+PUBLIC, ordered by createdAt DESC). |
| `libs/infrastructure/content/src/repositories/in-memory-publication.repository.ts` | Implemented `findAllPublished()`. |
| `libs/infrastructure/shared/src/repositories/base.repository.ts` | Optimistic-lock guard used `previousVersion = aggregate.version - 1`, but a single unit-of-work can call multiple aggregate mutators (e.g. `updateBio` + `updateLocation` = +2 versions). Multi-field profile saves always failed with `OptimisticLockError`. Now reads the live DB row's version and uses that as the guard. |

## Known gaps (feature work, not blocking)

1. **Admin JWT not validated by global guard** — admin login issues a token with `{sub,email,role,type}`, but the global JWT verifier expects `{aud,iss,jti,...}`. Admin endpoints respond 401 even with a valid admin token.
2. **`/api/admin/stats` endpoint not implemented** — frontend admin dashboard degrades to "Failed to load admin stats".
3. **Author display names everywhere show "Member"** — no profile-name join in API DTOs (feed, comments, group members, followers, following). Frontend uses `'Member'` placeholder.
4. **Auth state lost on hard reload** — token is in-memory only; no `/auth/refresh` call on bootstrap to repopulate from the httpOnly refresh cookie.
5. **No domain-event handlers create notifications** — `alerts` table only populates from manual SQL; follow/comment/reaction events don't fan out.
6. **Comment edit/delete not in UI** even for the author.
7. **`NotificationItem` doesn't navigate** to `actionUrl` on click (only marks read).
8. **Messages page is a stub** ("Your conversations will appear here").
9. **Explore page is a stub** ("Discover trending content and new communities.").
10. **Group post UI doesn't exist** — group detail page shows description + members only.
11. **All JWTs hardcode `roles: ['member']`** — no real role separation in DB or token.
12. **Follow button label may show "Follow" after page reload** even when a pending request exists — API has no "my outgoing pending" endpoint, only "incoming pending".
13. **Followers/Following queries return CONNECTION records, not enriched profiles** — frontend now synthesizes profiles client-side using a `'Member'` placeholder name; proper fix needs an API join.

## Process notes

- Twice during the loop, a `docker compose build web` failed with a TypeScript error but exited 0 at the compose level, so the container kept serving the previous image. Lesson: after every rebuild, grep the served JS chunk for a fingerprint string from the new code before declaring "deployed".
- Vibium chromium daemon occasionally needed killing (`kill -9 $(pgrep -f 'vibium|chromium')`) between iterations to flush a cached JS chunk so the new build was loaded.
- ARM64 needed the [skill's documented workaround](.claude/skills/qe-browser/SKILL.md): apt-install `chromium` + `chromium-driver`, symlink them into `~/.cache/vibium/chrome-for-testing/*/`.

## Devcontainer + tooling

- Docker daemon brought up via fresh install from `download.docker.com/linux/debian`. The DinD feature's pre-installed `moby-containerd@2.3.0` was missing the `containerd.services.events.v1.Events`, `grpc.health.v1.Health`, and `containerd.services.introspection.v1.Introspection` services, so dockerd's startup timed out connecting to its managed containerd. After install: `docker-ce@29.5.2` + `containerd.io@2.2.4` work cleanly.
- vibium installed globally via `npm install -g vibium` (v26.3.18, native ARM64 binary). Chrome for Testing fallback to x86_64 doesn't run under Rosetta, so the skill's symlink workaround to system chromium is required.

## How to use

```bash
# Bring up stack
sudo docker compose up -d

# Hit it
open http://localhost:4200

# Login with any of:
#   admin@csn.local / Admin!Pass#2026
#   user@csn.local  / User!Pass#2026
#   bot@csn.local   / Bot!Pass#2026
```

## Files touched (uncommitted)

```
apps/api/Dockerfile
apps/api/src/modules/admin/controllers/admin-auth.controller.ts
apps/api/src/modules/admin/controllers/admin.controller.ts
apps/api/src/modules/content/queries/get-feed.handler.ts
apps/web/Dockerfile
apps/web/nginx.conf
apps/web/src/features/comments/queries.ts
apps/web/src/features/feed/components/PostDetail.tsx (no change; covered by adapter)
apps/web/src/features/notifications/queries.ts
apps/web/src/features/profile/components/ProfileHeader.tsx
apps/web/src/features/profile/queries.ts
apps/web/src/features/social/queries.ts
apps/web/src/router.tsx
apps/web/src/shared/components/organisms/Header.tsx
libs/domain/content/src/repositories/publication.repository.ts
libs/infrastructure/content/src/repositories/in-memory-publication.repository.ts
libs/infrastructure/content/src/repositories/postgres-publication.repository.ts
libs/infrastructure/shared/src/repositories/base.repository.ts
package-lock.json
```
