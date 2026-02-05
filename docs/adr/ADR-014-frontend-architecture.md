# ADR-014: Frontend Architecture

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-003 (REST API), ADR-004 (JWT Authentication), ADR-007 (Bounded Contexts), ADR-009 (Domain Events), ADR-012 (Observability), ADR-013 (GDPR)

## Context

The Community Social Network has a REST API with OpenAPI documentation (ADR-003), WebSocket notifications via Socket.IO (ADR-009), and JWT dual-token authentication (ADR-004). The frontend is a React web application in the monorepo (ADR-001) at `apps/web/`. No ADR currently covers client-side architecture decisions.

Key frontend requirements:

1. **Type Safety**: Full TypeScript coverage with API types derived from backend contracts
2. **Server State**: Feed, posts, profiles, and notifications are server-owned data requiring cache management
3. **Real-Time**: WebSocket events must update the UI without manual refresh
4. **Authentication**: Dual-token flow (access in memory, refresh in HttpOnly cookie) per ADR-004
5. **Performance**: Fast initial load, code-split by route, optimistic UI for social interactions
6. **Bounded Context Alignment**: Feature modules mirror the 7 backend bounded contexts (ADR-007)
7. **Accessibility**: WCAG 2.1 AA compliance required for inclusive access
8. **Internationalization**: Multi-language support with lazy-loaded translation bundles
9. **Privacy**: GDPR-compliant UI flows for cookie consent, data export, and account deletion (ADR-013)
10. **Testability**: Comprehensive testing strategy spanning unit, component, integration, and end-to-end layers

Performance targets inherited from the backend specification:
- p95 API response time < 500ms
- Support 10,000+ registered users
- 1,000 concurrent active users
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s

## Decision

We adopt **React 18+ with TypeScript** using a feature-module architecture aligned with backend bounded contexts. Server state is managed by **TanStack Query**, client state by **Zustand**, and real-time updates by **Socket.IO client** with event-to-cache-invalidation mapping. The application is bundled with **Vite**, tested with **Vitest + React Testing Library + Playwright**, and validated with **React Hook Form + Zod**.

---

### 1. Technology Stack

```
+---------------------+----------------------------+-------------------------------+
| Concern             | Technology                 | Rationale                     |
+---------------------+----------------------------+-------------------------------+
| UI Framework        | React 18+                  | Component model, ecosystem    |
| Language            | TypeScript 5.x (strict)    | Type safety, refactoring      |
| Build Tool          | Vite 5+                    | Fast HMR, ESBuild bundling    |
| Server State        | TanStack Query v5          | Cache, dedup, background sync |
| Client State        | Zustand v4                 | Minimal, no boilerplate       |
| Routing             | React Router v6            | Nested routes, lazy loading   |
| Styling             | Tailwind CSS v3            | Utility-first, tree-shaking   |
| Real-Time           | Socket.IO Client v4        | Matches backend Socket.IO     |
| API Client          | Generated (openapi-ts)     | Type-safe, auto-synced        |
| Forms               | React Hook Form + Zod      | Performant, schema validation |
| i18n                | i18next + react-i18next    | Lazy-loaded namespaces        |
| Testing (Unit)      | Vitest                     | Vite-native, fast             |
| Testing (Component) | React Testing Library      | Accessible query semantics    |
| Testing (E2E)       | Playwright                 | Cross-browser, reliable       |
| Testing (API Mock)  | MSW (Mock Service Worker)  | Network-level API mocking     |
| Accessibility       | axe-core + eslint-plugin-jsx-a11y | Automated a11y checks  |
+---------------------+----------------------------+-------------------------------+
```

---

### 2. Project Structure

The feature-module layout mirrors backend bounded contexts defined in ADR-007. Each feature module is self-contained with its own components, hooks, API calls, types, and translations.

```
apps/web/src/
|
+-- api/                        # Generated API client layer
|   +-- generated/              # Auto-generated from OpenAPI spec
|   |   +-- types.ts            # Request/response types
|   |   +-- services/           # Per-tag service classes
|   +-- client.ts               # Axios instance with interceptors
|   +-- error-handler.ts        # Centralized ApiError handling
|
+-- features/                   # Feature modules (1:1 with bounded contexts)
|   +-- auth/                   # Identity Context (M1)
|   |   +-- components/         # LoginForm, RegisterForm, VerifyEmail
|   |   +-- hooks/              # useLogin, useRegister, useCurrentUser
|   |   +-- routes.tsx          # /login, /register, /verify-email
|   |   +-- i18n/               # en.json, fr.json, de.json, ...
|   |   +-- index.ts            # Public API of feature
|   |
|   +-- profile/                # Profile Context (M2)
|   |   +-- components/         # ProfileCard, AvatarUpload, ProfileSettings
|   |   +-- hooks/              # useProfile, useUpdateProfile
|   |   +-- queries.ts          # Query key factories and fetch functions
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- feed/                   # Content Context -- Posts (M3)
|   |   +-- components/         # FeedList, PostCard, CreatePostForm
|   |   +-- hooks/              # useFeed, useCreatePost, useReaction
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- comments/               # Content Context -- Discussions (M4)
|   |   +-- components/         # CommentThread, CommentForm
|   |   +-- hooks/              # useComments, useCreateComment
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- social/                 # Social Graph Context (M6)
|   |   +-- components/         # FollowersList, FollowButton
|   |   +-- hooks/              # useFollow, useBlock, useFollowers
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- groups/                 # Community Context (M5)
|   |   +-- components/         # GroupCard, MemberList, GroupSettings
|   |   +-- hooks/              # useGroup, useJoinGroup, useGroupMembers
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- notifications/          # Notification Context (M7)
|   |   +-- components/         # NotificationList, NotificationBadge
|   |   +-- hooks/              # useNotifications, useMarkRead
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- admin/                  # Admin Context (M8)
|   |   +-- components/         # Dashboard, AuditLog, UserManagement
|   |   +-- hooks/              # useAdminStats, useAuditLog
|   |   +-- queries.ts
|   |   +-- routes.tsx
|   |   +-- i18n/
|   |   +-- index.ts
|   |
|   +-- privacy/                # GDPR / Privacy features (ADR-013 alignment)
|       +-- components/         # CookieConsentBanner, DataExportRequest, DeleteAccount
|       +-- hooks/              # useCookieConsent, useDataExport, useDeleteAccount
|       +-- routes.tsx
|       +-- i18n/
|       +-- index.ts
|
+-- shared/                     # Cross-feature shared code
|   +-- components/             # Atomic design components
|   |   +-- atoms/              # Button, Input, Badge, Avatar, Spinner, Icon
|   |   +-- molecules/          # FormField, SearchBar, DropdownMenu, Toast
|   |   +-- organisms/          # Header, Sidebar, Modal, DataTable
|   +-- hooks/                  # useDebounce, useIntersectionObserver, useMediaQuery
|   +-- layouts/                # AppLayout, AuthLayout, AdminLayout
|   +-- utils/                  # Date formatting, validation helpers, constants
|   +-- types.ts                # Shared frontend types
|   +-- error-boundary.tsx      # Global and route-level error boundaries
|   +-- query-config.ts         # TanStack Query default options
|
+-- stores/                     # Global Zustand stores
|   +-- auth.store.ts           # Auth state (tokens, current user)
|   +-- ui.store.ts             # UI preferences (theme, sidebar)
|   +-- notification.store.ts   # Real-time notification badge count
|   +-- toast.store.ts          # Toast notification queue
|
+-- socket/                     # Socket.IO integration
|   +-- socket-provider.tsx     # React context for socket instance
|   +-- use-socket-events.ts    # Hook for subscribing to events
|   +-- event-invalidation.ts   # Maps WS events to query invalidation
|
+-- i18n/                       # i18next configuration
|   +-- config.ts               # i18n initialization, lazy backend
|   +-- locales/                # Shared translations (common, errors, validation)
|       +-- en/common.json
|       +-- fr/common.json
|       +-- de/common.json
|
+-- App.tsx                     # Root component, providers, router
+-- main.tsx                    # Entry point
+-- vite-env.d.ts               # Vite type declarations
+-- service-worker.ts           # Offline caching, push notifications
```

#### Module Dependency Rules

```
+-------------------------------------------------------------------+
|                        Dependency Rules                            |
+-------------------------------------------------------------------+
|                                                                   |
|  features/auth  ----->  shared/       (allowed)                   |
|  features/auth  ----->  api/          (allowed)                   |
|  features/auth  ----->  stores/       (allowed)                   |
|  features/auth  ----->  socket/       (allowed)                   |
|  features/auth  --X-->  features/feed (FORBIDDEN)                 |
|                                                                   |
|  Rule: Feature modules MUST NOT import from other features.       |
|        Cross-feature communication uses stores or router params.  |
|                                                                   |
+-------------------------------------------------------------------+
```

Features communicate through:
- **Zustand stores**: For shared state (e.g., auth store consumed by all features)
- **Router params/search params**: For navigation between features
- **TanStack Query cache**: Features read from the shared cache but own their own query keys

---

### 3. Component Architecture (Atomic Design)

Components follow the atomic design methodology to ensure consistency and reusability across all feature modules.

```
+-----------------------------------------------------------------------+
|                     Component Architecture                              |
+-----------------------------------------------------------------------+
|                                                                        |
|  ATOMS (Stateless, single-purpose)                                     |
|    Button, Input, Textarea, Badge, Avatar, Spinner, Icon, Link,        |
|    Label, Checkbox, Radio, Switch, Tooltip, VisuallyHidden             |
|                                                                        |
|  MOLECULES (Composed of atoms, minor behavior)                         |
|    FormField (Label + Input + ErrorMessage)                             |
|    SearchBar (Input + Icon + ClearButton)                               |
|    DropdownMenu (Button + Popover + MenuItems)                          |
|    Toast (Icon + Message + DismissButton)                               |
|    Pagination (Button + PageNumbers + NavigationArrows)                 |
|    UserAvatar (Avatar + OnlineIndicator)                                |
|                                                                        |
|  ORGANISMS (Feature-level composites)                                   |
|    Header (Logo + Navigation + UserMenu + NotificationBadge)            |
|    Sidebar (NavigationLinks + GroupList + CollapsibleSections)           |
|    Modal (Overlay + Header + Body + Footer)                             |
|    DataTable (Header + Rows + Pagination + Sorting)                     |
|    InfiniteList (VirtualScroller + LoadingIndicator + EndMarker)         |
|                                                                        |
|  TEMPLATES (Page-level layouts in shared/layouts/)                      |
|    AppLayout, AuthLayout, AdminLayout                                   |
|                                                                        |
|  PAGES (Route-level components in features/*/routes.tsx)                |
|    FeedPage, ProfilePage, GroupDetailPage, NotificationsPage            |
|                                                                        |
+-----------------------------------------------------------------------+
```

All shared components in `shared/components/atoms/` and `shared/components/molecules/` expose a consistent prop interface with accessibility attributes (`aria-label`, `aria-describedby`, `role`) as first-class parameters, not afterthoughts.

---

### 4. API Client Generation

The API client is auto-generated from the backend OpenAPI specification to guarantee type safety between frontend and backend contracts.

#### Generation Pipeline

```
Backend OpenAPI Spec               Generated Client              Feature Hooks
(apps/api/openapi.json)            (apps/web/src/api/)           (features/*/hooks/)

+-------------------+    codegen   +-------------------+   wrap  +-------------------+
| openapi: 3.0      |------------>| types.ts           |------->| useCreatePost()   |
| paths:             |             | services/          |        | useFeed()         |
|   /api/v1/posts:   |             |   PostsService.ts  |        | useProfile()      |
|     post: ...      |             |   AuthService.ts   |        |                   |
|     get: ...       |             |   UsersService.ts  |        |                   |
+-------------------+             +-------------------+         +-------------------+
```

#### Code Generation Configuration

```typescript
// orval.config.ts
export default {
  'community-api': {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      target: './src/api/generated',
      client: 'axios-functions',
      mode: 'tags-split',        // One file per API tag
      override: {
        mutator: {
          path: './src/api/client.ts',
          name: 'apiClient',
        },
      },
    },
  },
};
```

#### Axios Client with Interceptors

```typescript
// apps/web/src/api/client.ts

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth.store';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,  // Send HttpOnly refresh cookie
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'en',  // Updated by i18n interceptor
  },
});

// Request interceptor: attach access token and language
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach current language for server-side message localization
  const lang = document.documentElement.lang || 'en';
  config.headers['Accept-Language'] = lang;

  return config;
});

// Response interceptor: handle 401 with token refresh
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Prevent retry loops on the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    }

    // Deduplicate concurrent refresh requests
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }

    try {
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch {
      useAuthStore.getState().logout();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    } finally {
      refreshPromise = null;
    }
  }
);

async function refreshAccessToken(): Promise<string> {
  // Cookie is sent automatically (withCredentials: true)
  const { data } = await axios.post('/api/v1/auth/refresh', null, {
    withCredentials: true,
  });
  const newToken = data.data.accessToken;
  useAuthStore.getState().setAccessToken(newToken);
  return newToken;
}
```

#### Centralized Error Handling

```typescript
// apps/web/src/api/error-handler.ts

import axios from 'axios';

// Matches the ApiError format from ADR-003
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

export function extractApiError(error: unknown): ApiErrorResponse['error'] {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return error.response.data.error;
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: 'unknown',
  };
}

// Maps all 28 API error codes (ADR-003) to i18n translation keys.
// The actual user-facing strings live in locales/*/errors.json for
// internationalization support (Section 14).
const ERROR_CODE_TO_I18N_KEY: Record<string, string> = {
  // Identity context
  AUTH_INVALID_CREDENTIALS:  'errors.auth.invalidCredentials',
  AUTH_ACCOUNT_LOCKED:       'errors.auth.accountLocked',
  AUTH_TOKEN_EXPIRED:        'errors.auth.tokenExpired',
  AUTH_TOKEN_REVOKED:        'errors.auth.tokenRevoked',
  AUTH_REFRESH_INVALID:      'errors.auth.refreshInvalid',
  AUTH_2FA_REQUIRED:         'errors.auth.twoFactorRequired',
  AUTH_2FA_INVALID:          'errors.auth.twoFactorInvalid',

  // Validation
  VALIDATION_ERROR:          'errors.validation.generic',
  VALIDATION_FIELD_REQUIRED: 'errors.validation.fieldRequired',
  VALIDATION_FIELD_INVALID:  'errors.validation.fieldInvalid',

  // Resource
  RESOURCE_NOT_FOUND:        'errors.resource.notFound',
  RESOURCE_ALREADY_EXISTS:   'errors.resource.alreadyExists',

  // Content context
  CONTENT_TOO_LONG:          'errors.content.tooLong',
  CONTENT_EMPTY:             'errors.content.empty',
  CONTENT_MAX_DEPTH:         'errors.content.maxDepth',

  // Social graph context
  SOCIAL_SELF_ACTION:        'errors.social.selfAction',
  SOCIAL_ALREADY_FOLLOWING:  'errors.social.alreadyFollowing',
  SOCIAL_BLOCKED:            'errors.social.blocked',
  SOCIAL_FOLLOW_PENDING:     'errors.social.followPending',

  // Community context
  GROUP_NOT_MEMBER:          'errors.group.notMember',
  GROUP_INSUFFICIENT_ROLE:   'errors.group.insufficientRole',
  GROUP_MAX_RULES:           'errors.group.maxRules',

  // Media / Profile context
  MEDIA_INVALID_TYPE:        'errors.media.invalidType',
  MEDIA_TOO_LARGE:           'errors.media.tooLarge',
  MEDIA_QUOTA_EXCEEDED:      'errors.media.quotaExceeded',

  // System
  RATE_LIMIT_EXCEEDED:       'errors.system.rateLimited',
  PERMISSION_DENIED:         'errors.system.permissionDenied',
  INTERNAL_ERROR:            'errors.system.internal',
};

/**
 * Returns the i18n translation key for a given API error code.
 * Falls back to a generic error key if the code is unrecognized.
 */
export function getErrorI18nKey(code: string): string {
  return ERROR_CODE_TO_I18N_KEY[code] || 'errors.system.unknown';
}

/**
 * Returns a static English fallback message for a given API error code.
 * Used only when the i18n system has not initialized (e.g., during app boot).
 */
export function getUserMessageFallback(code: string): string {
  const FALLBACK_MESSAGES: Record<string, string> = {
    AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
    AUTH_ACCOUNT_LOCKED: 'Your account has been locked. Try again later.',
    VALIDATION_ERROR: 'Please check the form for errors.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment.',
    SOCIAL_SELF_ACTION: 'You cannot perform this action on yourself.',
    SOCIAL_BLOCKED: 'This interaction is not available.',
    CONTENT_TOO_LONG: 'Your content exceeds the maximum length.',
  };
  return FALLBACK_MESSAGES[code] || 'Something went wrong. Please try again.';
}
```

---

### 5. Server State Management (TanStack Query)

All server-owned data is managed through TanStack Query. Zustand is NOT used for server state.

#### Query Key Factory Pattern

Query keys follow a hierarchical structure aligned with API resources. Each bounded context defines a key factory that produces stable, deterministic cache keys.

```typescript
// apps/web/src/features/feed/queries.ts

export const feedKeys = {
  all:      ['feed'] as const,
  list:     (cursor?: string) => ['feed', { cursor }] as const,
};

export const postKeys = {
  all:      ['posts'] as const,
  detail:   (postId: string) => ['posts', postId] as const,
  comments: (postId: string) => ['posts', postId, 'comments'] as const,
  reactions:(postId: string) => ['posts', postId, 'reactions'] as const,
};

// apps/web/src/features/profile/queries.ts

export const userKeys = {
  all:       ['users'] as const,
  detail:    (userId: string) => ['users', userId] as const,
  me:        ['users', 'me'] as const,
  posts:     (userId: string) => ['users', userId, 'posts'] as const,
  followers: (userId: string) => ['users', userId, 'followers'] as const,
  following: (userId: string) => ['users', userId, 'following'] as const,
};

// apps/web/src/features/notifications/queries.ts

export const notificationKeys = {
  all:     ['notifications'] as const,
  list:    (cursor?: string) => ['notifications', { cursor }] as const,
  unread:  ['notifications', 'unread'] as const,
};

// apps/web/src/features/groups/queries.ts

export const groupKeys = {
  all:     ['groups'] as const,
  detail:  (groupId: string) => ['groups', groupId] as const,
  members: (groupId: string) => ['groups', groupId, 'members'] as const,
  myGroups:['groups', 'mine'] as const,
};

// apps/web/src/features/social/queries.ts

export const socialKeys = {
  followStatus: (userId: string) => ['social', 'followStatus', userId] as const,
  blockStatus:  (userId: string) => ['social', 'blockStatus', userId] as const,
  suggestions:  ['social', 'suggestions'] as const,
};

// apps/web/src/features/admin/queries.ts

export const adminKeys = {
  stats:     ['admin', 'stats'] as const,
  auditLog:  (cursor?: string) => ['admin', 'auditLog', { cursor }] as const,
  users:     (filters?: Record<string, unknown>) =>
               ['admin', 'users', filters] as const,
};
```

#### Stale Time and GC Time Configuration

Different resource types have different freshness requirements:

```typescript
// apps/web/src/shared/query-config.ts

import { QueryClient } from '@tanstack/react-query';

export const STALE_TIMES = {
  feed:          30_000,      // 30s  - Feed changes frequently
  post:          60_000,      // 1m   - Individual posts are fairly stable
  profile:       120_000,     // 2m   - Profiles change rarely
  followers:     120_000,     // 2m   - Follower counts change moderately
  groups:        300_000,     // 5m   - Group data is mostly stable
  notifications: 15_000,      // 15s  - Notifications should feel real-time
  admin:         60_000,      // 1m   - Admin dashboards refresh frequently
} as const;

export const GC_TIMES = {
  feed:          600_000,     // 10m  - Garbage collect stale feed data
  post:          1_800_000,   // 30m  - Keep post data in cache longer
  profile:       1_800_000,   // 30m  - Keep profile data in cache longer
  groups:        3_600_000,   // 1h   - Group data is stable
  notifications: 300_000,     // 5m   - Notifications are ephemeral
} as const;

export const RETRY_CONFIG = {
  default: 3,
  auth: 0,               // Auth failures should not retry
  mutations: 1,          // Mutations retry once at most
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.post,
      gcTime: GC_TIMES.post,
      retry: RETRY_CONFIG.default,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: RETRY_CONFIG.mutations,
    },
  },
});
```

#### Infinite Scroll with Cursor Pagination

```typescript
// apps/web/src/features/feed/hooks/useFeed.ts

import { useInfiniteQuery } from '@tanstack/react-query';
import { feedKeys } from '../queries';
import { STALE_TIMES, GC_TIMES } from '../../../shared/query-config';
import { getFeed } from '../../../api/generated/services/FeedService';

export function useFeed() {
  return useInfiniteQuery({
    queryKey: feedKeys.all,
    queryFn: ({ pageParam }) => getFeed({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? lastPage.meta.cursor : undefined,
    staleTime: STALE_TIMES.feed,
    gcTime: GC_TIMES.feed,
  });
}
```

#### Optimistic Updates

Social interactions (reactions, follows) use optimistic updates for immediate UI feedback:

```typescript
// apps/web/src/features/feed/hooks/useReaction.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postKeys } from '../queries';
import { addReaction } from '../../../api/generated/services/PostsService';

interface Post {
  id: string;
  reactions: Record<string, number> & { userReaction: string | null };
  // ...other fields
}

export function useReaction(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reactionType: string) => addReaction(postId, { reactionType }),

    onMutate: async (reactionType) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Post>(postKeys.detail(postId));

      // Optimistically update the cache
      queryClient.setQueryData<Post>(postKeys.detail(postId), (old) => {
        if (!old) return old;
        return {
          ...old,
          reactions: {
            ...old.reactions,
            [reactionType]: (old.reactions[reactionType] || 0) + 1,
            userReaction: reactionType,
          },
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(postKeys.detail(postId), context.previous);
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
```

---

### 6. Client State Management (Zustand)

Client state stores are minimal. They hold only UI-local or ephemeral state that does not belong to the server.

#### Auth Store

```typescript
// apps/web/src/stores/auth.store.ts

import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  displayName: string;
  avatarUrl: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  setInitializing: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isInitializing: true,  // True until silent refresh completes

  setAccessToken: (token) =>
    set({ accessToken: token, isAuthenticated: true, isInitializing: false }),
  setUser: (user) => set({ user }),
  setInitializing: (value) => set({ isInitializing: value }),
  logout: () => {
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isInitializing: false,
    });
    // Refresh token cookie is cleared by the server on POST /auth/logout
  },
}));
```

#### UI Store

```typescript
// apps/web/src/stores/ui.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  activeModal: string | null;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      activeModal: null,

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openModal: (modalId) => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),
    }),
    { name: 'csn-ui-preferences' }
  )
);
```

#### Toast Store

```typescript
// apps/web/src/stores/toast.store.ts

import { create } from 'zustand';

type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  severity: ToastSeverity;
  messageKey: string;       // i18n translation key
  messageParams?: Record<string, string>;
  duration: number;         // ms, 0 = persistent
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: String(++nextId) }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}));
```

#### Notification Store (Real-Time Badge)

```typescript
// apps/web/src/stores/notification.store.ts

import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;
  increment: () => void;
  setCount: (count: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  setCount: (count) => set({ unreadCount: count }),
  reset: () => set({ unreadCount: 0 }),
}));
```

The `notification.alert_created` WebSocket event both invalidates the notifications query cache AND increments the badge counter through the notification store. This ensures the badge updates immediately without waiting for a network round-trip.

#### State Ownership Rules

```
+-----------------------------+-------------------+------------------------------+
| Data                        | Owner             | Rationale                    |
+-----------------------------+-------------------+------------------------------+
| Posts, comments, reactions   | TanStack Query    | Server-owned, cached         |
| User profiles, followers    | TanStack Query    | Server-owned, cached         |
| Feed items, notifications   | TanStack Query    | Server-owned, paginated      |
| Groups, memberships         | TanStack Query    | Server-owned, cached         |
| Access token                | Zustand (memory)  | Ephemeral, never persisted   |
| Current user summary        | Zustand (memory)  | Derived from token/login     |
| Theme preference            | Zustand (persist) | Client-only, localStorage    |
| Sidebar state               | Zustand (persist) | Client-only, localStorage    |
| Modal state                 | Zustand (memory)  | Ephemeral UI state           |
| Toast queue                 | Zustand (memory)  | Ephemeral UI state           |
| Unread notification count   | Zustand (memory)  | Updated via WebSocket        |
| Form field values           | React Hook Form   | Component-local, ephemeral   |
| Cookie consent choices      | Zustand (persist) | Client-only + server sync    |
+-----------------------------+-------------------+------------------------------+
```

---

### 7. Real-Time Subscriptions (Socket.IO)

#### Connection Lifecycle

```
+-----------------------------------------------------------------------+
|                   Socket.IO Connection Lifecycle                      |
+-----------------------------------------------------------------------+

  User logs in
       |
       v
  [Auth store updates accessToken]
       |
       v
  [SocketProvider detects token]
       |
       v
  [socket.connect() with auth: { token }]
       |
       v
  [Server authenticates, joins room user:{userId}]
       |
       +--> Subscribe to page-specific rooms:
       |      post:{postId}   (when viewing a post)
       |      group:{groupId} (when viewing a group)
       |
       v
  [Listen for events, map to query invalidation]
       |
       v
  User logs out
       |
       v
  [socket.disconnect()]
```

#### Socket Provider

```typescript
// apps/web/src/socket/socket-provider.tsx

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { registerEventInvalidation } from './event-invalidation';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setSocket(null);
      return;
    }

    const newSocket = io(import.meta.env.VITE_WS_URL || '', {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      transports: ['websocket', 'polling'],
    });

    // Register event-to-query-invalidation mapping
    cleanupRef.current = registerEventInvalidation(newSocket, queryClient);
    setSocket(newSocket);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      newSocket.disconnect();
    };
  }, [accessToken, queryClient]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
```

#### Event-to-Query Invalidation Mapping

When a WebSocket event arrives, the corresponding TanStack Query cache entries are invalidated so the UI fetches fresh data automatically.

```typescript
// apps/web/src/socket/event-invalidation.ts

import { QueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { feedKeys, postKeys } from '../features/feed/queries';
import { notificationKeys } from '../features/notifications/queries';
import { userKeys } from '../features/profile/queries';
import { groupKeys } from '../features/groups/queries';
import { useNotificationStore } from '../stores/notification.store';

// Maps domain events (ADR-009) to query keys that must be invalidated.
// Each entry returns an array of query key arrays to invalidate.
const EVENT_INVALIDATION_MAP: Record<string, (payload: any) => unknown[][]> = {

  // Content events
  'content.publication_created': () => [
    feedKeys.all,
  ],
  'content.publication_edited': (p) => [
    feedKeys.all,
    postKeys.detail(p.publicationId),
  ],
  'content.publication_deleted': (p) => [
    feedKeys.all,
    postKeys.detail(p.publicationId),
  ],
  'content.discussion_created': (p) => [
    postKeys.comments(p.publicationId),
  ],
  'content.reaction_added': (p) => [
    postKeys.detail(p.targetId),
    postKeys.reactions(p.targetId),
  ],

  // Social graph events
  'social_graph.member_followed': (p) => [
    userKeys.followers(p.followingId),
    userKeys.following(p.followerId),
    userKeys.detail(p.followingId),
    userKeys.detail(p.followerId),
  ],
  'social_graph.member_unfollowed': (p) => [
    userKeys.followers(p.followingId),
    userKeys.following(p.followerId),
    userKeys.detail(p.followingId),
    userKeys.detail(p.followerId),
  ],
  'social_graph.member_blocked': (p) => [
    userKeys.detail(p.blockedId),
    feedKeys.all,  // Feed should exclude blocked user content
  ],
  'social_graph.member_unblocked': (p) => [
    userKeys.detail(p.blockedId),
    feedKeys.all,
  ],

  // Notification events
  'notification.alert_created': () => [
    notificationKeys.unread,
    notificationKeys.all,
  ],

  // Community events
  'community.member_joined_group': (p) => [
    groupKeys.members(p.groupId),
    groupKeys.detail(p.groupId),
  ],
  'community.member_left_group': (p) => [
    groupKeys.members(p.groupId),
    groupKeys.detail(p.groupId),
  ],
  'community.member_promoted': (p) => [
    groupKeys.members(p.groupId),
  ],
  'community.member_kicked': (p) => [
    groupKeys.members(p.groupId),
    groupKeys.detail(p.groupId),
  ],
  'community.group_settings_updated': (p) => [
    groupKeys.detail(p.groupId),
  ],

  // Profile events
  'profile.profile_updated': (p) => [
    userKeys.detail(p.profileId),
  ],
  'profile.avatar_changed': (p) => [
    userKeys.detail(p.profileId),
  ],
};

export function registerEventInvalidation(
  socket: Socket,
  queryClient: QueryClient
): () => void {
  const handlers: Array<[string, (...args: any[]) => void]> = [];

  for (const [eventType, getKeys] of Object.entries(EVENT_INVALIDATION_MAP)) {
    const handler = (payload: any) => {
      const keySets = getKeys(payload);
      for (const key of keySets) {
        queryClient.invalidateQueries({ queryKey: key });
      }

      // Special handling: increment unread badge counter immediately
      if (eventType === 'notification.alert_created') {
        useNotificationStore.getState().increment();
      }
    };
    socket.on(eventType, handler);
    handlers.push([eventType, handler]);
  }

  // Return cleanup function
  return () => {
    for (const [eventType, handler] of handlers) {
      socket.off(eventType, handler);
    }
  };
}
```

#### Event-to-Invalidation Reference Table

| Domain Event (ADR-009)                | Invalidated Query Keys                                    |
|---------------------------------------|-----------------------------------------------------------|
| `content.publication_created`         | `['feed']`                                                |
| `content.publication_edited`          | `['feed']`, `['posts', postId]`                           |
| `content.publication_deleted`         | `['feed']`, `['posts', postId]`                           |
| `content.discussion_created`          | `['posts', postId, 'comments']`                           |
| `content.reaction_added`             | `['posts', targetId]`, `['posts', targetId, 'reactions']` |
| `social_graph.member_followed`        | `['users', userId, 'followers']`, `['users', userId, 'following']` |
| `social_graph.member_unfollowed`      | `['users', userId, 'followers']`, `['users', userId, 'following']` |
| `social_graph.member_blocked`         | `['users', blockedId]`, `['feed']`                        |
| `notification.alert_created`          | `['notifications', 'unread']`, `['notifications']`        |
| `community.member_joined_group`       | `['groups', groupId, 'members']`, `['groups', groupId]`   |
| `community.member_left_group`         | `['groups', groupId, 'members']`, `['groups', groupId]`   |
| `community.member_promoted`           | `['groups', groupId, 'members']`                          |
| `community.group_settings_updated`    | `['groups', groupId]`                                     |
| `profile.profile_updated`             | `['users', profileId]`                                    |
| `profile.avatar_changed`              | `['users', profileId]`                                    |

---

### 8. Authentication Flow

```
+-----------------------------------------------------------------------+
|                     Frontend Authentication Flow                      |
+-----------------------------------------------------------------------+

  App Startup
       |
       v
  POST /api/v1/auth/refresh      <-- Cookie sent automatically
       |
       +-- 200 OK ----> Store accessToken in Zustand (memory)
       |                 Fetch /api/v1/users/me -> set user in Zustand
       |                 Connect Socket.IO
       |                 Set isInitializing = false
       |                 Render authenticated routes
       |
       +-- 401 -------> Set isInitializing = false
       |                 Render login page
       |                 (No stored token to clear; cookie expired)

  API Request (any endpoint)
       |
       v
  Axios request interceptor attaches Authorization header
       |
       v
  Server responds
       |
       +-- 200 OK ----> Normal response
       |
       +-- 401 -------> Interceptor calls POST /auth/refresh
                              |
                              +-- 200 OK ----> Retry original request
                              |
                              +-- 401 -------> Call logout(), redirect to /login
```

Key security decisions per ADR-004:
- **Access token**: Stored ONLY in Zustand (JavaScript memory). Never persisted to localStorage or sessionStorage. Lost on page refresh, recovered via silent refresh.
- **Refresh token**: HttpOnly cookie, managed entirely by the browser and server. Frontend JavaScript cannot read it.
- **Silent refresh on startup**: The app attempts `POST /auth/refresh` on mount. If the HttpOnly cookie is valid, the user is transparently re-authenticated.

#### Protected Route Component

```typescript
// apps/web/src/shared/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, user } = useAuthStore();
  const location = useLocation();

  // Show nothing (or a loading spinner) while the silent refresh is in progress
  if (isInitializing) {
    return (
      <div
        role="status"
        aria-label="Loading authentication"
        className="flex items-center justify-center h-screen"
      >
        <span className="sr-only">Checking authentication...</span>
        {/* spinner rendered here */}
      </div>
    );
  }

  // Redirect to login if not authenticated, preserving the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check role-based access (e.g., admin routes)
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

#### Admin Protected Route

```typescript
// apps/web/src/shared/components/AdminRoute.tsx

import { ProtectedRoute } from './ProtectedRoute';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>;
}
```

---

### 9. Routing and Code Splitting

```typescript
// apps/web/src/App.tsx

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './shared/query-config';
import { SocketProvider } from './socket/socket-provider';
import { AppLayout } from './shared/layouts/AppLayout';
import { AuthLayout } from './shared/layouts/AuthLayout';
import { AdminLayout } from './shared/layouts/AdminLayout';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { AdminRoute } from './shared/components/AdminRoute';
import { RouteErrorBoundary } from './shared/error-boundary';

// Lazy-loaded feature routes -- each becomes a separate Vite chunk
const FeedRoutes       = lazy(() => import('./features/feed/routes'));
const ProfileRoutes    = lazy(() => import('./features/profile/routes'));
const CommentsRoutes   = lazy(() => import('./features/comments/routes'));
const SocialRoutes     = lazy(() => import('./features/social/routes'));
const GroupRoutes      = lazy(() => import('./features/groups/routes'));
const NotifRoutes      = lazy(() => import('./features/notifications/routes'));
const AdminRoutes      = lazy(() => import('./features/admin/routes'));
const PrivacyRoutes    = lazy(() => import('./features/privacy/routes'));

// Auth routes are NOT lazy-loaded (needed immediately for initial render)
import { AuthRoutes } from './features/auth/routes';

const LoadingFallback = (
  <div role="status" aria-label="Loading page" className="flex justify-center p-8">
    <span className="sr-only">Loading...</span>
    {/* Spinner component */}
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Suspense fallback={LoadingFallback}><FeedRoutes /></Suspense> },
      { path: 'profile/*', element: <Suspense fallback={LoadingFallback}><ProfileRoutes /></Suspense> },
      { path: 'posts/*', element: <Suspense fallback={LoadingFallback}><CommentsRoutes /></Suspense> },
      { path: 'social/*', element: <Suspense fallback={LoadingFallback}><SocialRoutes /></Suspense> },
      { path: 'groups/*', element: <Suspense fallback={LoadingFallback}><GroupRoutes /></Suspense> },
      { path: 'notifications/*', element: <Suspense fallback={LoadingFallback}><NotifRoutes /></Suspense> },
      { path: 'privacy/*', element: <Suspense fallback={LoadingFallback}><PrivacyRoutes /></Suspense> },
    ],
  },
  {
    path: '/auth/*',
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [{ path: '*', element: <AuthRoutes /> }],
  },
  {
    path: '/admin/*',
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '*', element: <Suspense fallback={LoadingFallback}><AdminRoutes /></Suspense> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

Each feature's `routes.tsx` is a separate chunk, downloaded only when the user navigates to that section. The expected chunk sizes are:

| Chunk               | Estimated Size (gzipped) |
|---------------------|--------------------------|
| `vendor` (React, Router, Query, Zustand) | ~45 KB |
| `auth`              | ~15 KB |
| `feed`              | ~25 KB |
| `profile`           | ~20 KB |
| `comments`          | ~12 KB |
| `social`            | ~10 KB |
| `groups`            | ~18 KB |
| `notifications`     | ~10 KB |
| `admin`             | ~30 KB |
| `privacy`           | ~8 KB  |

---

### 10. Form Handling (React Hook Form + Zod)

All forms use React Hook Form for performance (uncontrolled components, minimal re-renders) and Zod for schema validation. Zod schemas mirror the backend DTO validation rules to catch errors client-side before submission.

```typescript
// apps/web/src/features/auth/schemas.ts

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  password: z
    .string()
    .min(1, 'validation.password.required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.email.required')
    .email('validation.email.invalid'),
  password: z
    .string()
    .min(8, 'validation.password.minLength')
    .regex(/[A-Z]/, 'validation.password.uppercase')
    .regex(/[a-z]/, 'validation.password.lowercase')
    .regex(/[0-9]/, 'validation.password.digit')
    .regex(/[^A-Za-z0-9]/, 'validation.password.special'),
  confirmPassword: z.string(),
  displayName: z
    .string()
    .min(2, 'validation.displayName.minLength')
    .max(50, 'validation.displayName.maxLength'),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, 'validation.terms.required'),
  acceptPrivacy: z
    .boolean()
    .refine((val) => val === true, 'validation.privacy.required'),
  optInEmailNotifications: z.boolean().default(false),
  optInAnalytics: z.boolean().default(false),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'validation.password.mismatch', path: ['confirmPassword'] }
);

export type RegisterFormData = z.infer<typeof registerSchema>;

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'validation.post.required')
    .max(5000, 'validation.post.maxLength'),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

export type CreatePostFormData = z.infer<typeof createPostSchema>;
```

#### Form Component Pattern

```typescript
// apps/web/src/features/auth/components/LoginForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { loginSchema, LoginFormData } from '../schemas';
import { useLogin } from '../hooks/useLogin';
import { FormField } from '../../../shared/components/molecules/FormField';
import { Button } from '../../../shared/components/atoms/Button';
import { extractApiError, getErrorI18nKey } from '../../../api/error-handler';

export function LoginForm() {
  const { t } = useTranslation('auth');
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login.mutateAsync(data);
    } catch (err) {
      const apiError = extractApiError(err);
      setError('root', { message: t(getErrorI18nKey(apiError.code)) });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={t('login.formLabel')}
    >
      {errors.root && (
        <div role="alert" className="text-red-600 mb-4">
          {errors.root.message}
        </div>
      )}

      <FormField
        label={t('login.email')}
        error={errors.email?.message ? t(errors.email.message) : undefined}
        {...register('email')}
        type="email"
        autoComplete="email"
        required
      />

      <FormField
        label={t('login.password')}
        error={errors.password?.message ? t(errors.password.message) : undefined}
        {...register('password')}
        type="password"
        autoComplete="current-password"
        required
      />

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="w-full mt-4"
      >
        {isSubmitting ? t('login.submitting') : t('login.submit')}
      </Button>
    </form>
  );
}
```

---

### 11. Error Boundaries

#### Route-Level Error Boundary

Each route segment has its own error boundary so that a failure in one feature does not take down the entire application.

```typescript
// apps/web/src/shared/error-boundary.tsx

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

// ------------------------------------------------------------------
// React Router error element (used in errorElement prop)
// ------------------------------------------------------------------
export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-screen p-8">
        <h1 className="text-4xl font-bold mb-4">{error.status}</h1>
        <p className="text-lg text-gray-600 mb-8">{error.statusText}</p>
        <Link
          to="/"
          className="text-blue-600 underline hover:text-blue-800"
        >
          Return to home
        </Link>
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col items-center justify-center h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-8">
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Refresh page
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Class-based error boundary for wrapping individual components
// ------------------------------------------------------------------
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Report to observability system (ADR-012)
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div role="alert" className="p-6 border border-red-200 rounded-lg bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            This section encountered an error
          </h2>
          <p className="text-red-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Error boundaries are composed at multiple levels:

```
App (global catch-all)
  +-- RouteErrorBoundary (per route segment via errorElement)
       +-- ErrorBoundary (per widget/organism within a page)
```

#### Error Reporting Integration

Caught errors are forwarded to the observability pipeline (ADR-012) using a lightweight reporter:

```typescript
// apps/web/src/shared/utils/error-reporter.ts

export function reportError(error: Error, context?: Record<string, unknown>): void {
  // In production, send to backend error collection endpoint
  if (import.meta.env.PROD) {
    navigator.sendBeacon(
      '/api/v1/telemetry/errors',
      JSON.stringify({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      })
    );
  }
}
```

---

### 12. Accessibility (WCAG 2.1 AA)

The application targets WCAG 2.1 AA compliance. Accessibility is enforced through automated tooling and mandatory patterns.

#### Compliance Requirements

| WCAG Criterion | Implementation |
|----------------|----------------|
| 1.1.1 Non-text Content | All images have `alt` text; decorative images use `alt=""` |
| 1.3.1 Info and Relationships | Semantic HTML (`<nav>`, `<main>`, `<article>`, `<aside>`, `<header>`, `<footer>`) |
| 1.4.3 Contrast (Minimum) | Tailwind color palette audited for 4.5:1 contrast ratio |
| 1.4.11 Non-text Contrast | Interactive elements have visible focus and hover states |
| 2.1.1 Keyboard | All interactive elements reachable via Tab; custom widgets support arrow keys |
| 2.1.2 No Keyboard Trap | Focus is managed correctly in modals and dropdowns (focus trap + escape) |
| 2.4.1 Bypass Blocks | Skip-to-content link at top of page |
| 2.4.3 Focus Order | Tab order matches visual order; `tabIndex` used sparingly |
| 2.4.7 Focus Visible | `:focus-visible` styles on all interactive elements |
| 3.2.2 On Input | No unexpected context changes on input focus |
| 4.1.2 Name, Role, Value | ARIA attributes on custom components (`role`, `aria-label`, `aria-expanded`, `aria-controls`) |

#### Automated Enforcement

```typescript
// eslint configuration (excerpt)
// .eslintrc.cjs

module.exports = {
  extends: [
    'plugin:jsx-a11y/recommended',
  ],
  rules: {
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/label-has-associated-control': 'error',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
  },
};
```

#### Skip Link Pattern

```typescript
// Rendered at the top of AppLayout before any other content
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600"
>
  Skip to main content
</a>

// The main content area
<main id="main-content" tabIndex={-1}>
  {/* Route content */}
</main>
```

#### Live Regions for Dynamic Content

```typescript
// Notification badge announces count changes to screen readers
<span
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {unreadCount > 0
    ? `${unreadCount} unread notifications`
    : 'No unread notifications'}
</span>
```

---

### 13. Internationalization (i18next)

The application uses i18next with lazy-loaded translation namespaces. Each bounded context feature has its own namespace to avoid loading unnecessary translations.

#### i18n Configuration

```typescript
// apps/web/src/i18n/config.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'de', 'es', 'pt'],
    ns: ['common', 'errors', 'validation'],    // Loaded eagerly
    defaultNS: 'common',
    backend: {
      // Translations loaded from static JSON files served by Vite
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'csn-language',
    },
    interpolation: {
      escapeValue: false,  // React already escapes
    },
    react: {
      useSuspense: true,   // Suspense boundary handles loading
    },
  });

export default i18n;
```

#### Namespace-per-Feature Loading

```typescript
// apps/web/src/features/groups/routes.tsx

import { useTranslation } from 'react-i18next';

export default function GroupRoutes() {
  // Lazy-load the 'groups' translation namespace when this route chunk loads
  const { t } = useTranslation('groups');

  return (
    <div>
      <h1>{t('groups.title')}</h1>
      {/* ... */}
    </div>
  );
}
```

#### Translation Namespace Map

| Namespace       | Loaded When                    | Content                          |
|-----------------|--------------------------------|----------------------------------|
| `common`        | App startup (eager)            | Nav items, generic labels, dates |
| `errors`        | App startup (eager)            | All 28 API error messages        |
| `validation`    | App startup (eager)            | Form validation messages         |
| `auth`          | `/auth/*` routes               | Login, register, verify forms    |
| `profile`       | `/profile/*` routes            | Profile page labels              |
| `feed`          | `/` (index route)              | Feed, post creation labels       |
| `comments`      | `/posts/*` routes              | Comment thread labels            |
| `social`        | `/social/*` routes             | Follow/block labels              |
| `groups`        | `/groups/*` routes             | Group management labels          |
| `notifications` | `/notifications/*` routes      | Notification type labels         |
| `admin`         | `/admin/*` routes              | Admin dashboard labels           |
| `privacy`       | `/privacy/*` routes            | GDPR flow labels                 |

---

### 14. GDPR UI (ADR-013 Alignment)

The frontend implements three user-facing privacy features required by ADR-013: cookie consent, data export, and account deletion.

#### Cookie Consent Banner

```typescript
// apps/web/src/features/privacy/components/CookieConsentBanner.tsx

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type ConsentLevel = 'essential' | 'analytics';

interface CookieConsent {
  essential: true;      // Always true, cannot be declined
  analytics: boolean;   // Opt-in, default false (ADR-013 Section 7)
  version: string;
  consentedAt: string;
}

const CONSENT_STORAGE_KEY = 'csn-cookie-consent';
const CURRENT_CONSENT_VERSION = '1.0';

export function CookieConsentBanner() {
  const { t } = useTranslation('privacy');
  const [visible, setVisible] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    } else {
      try {
        const parsed: CookieConsent = JSON.parse(stored);
        // Show banner again if consent version has changed
        if (parsed.version !== CURRENT_CONSENT_VERSION) {
          setVisible(true);
        }
      } catch {
        setVisible(true);
      }
    }
  }, []);

  const handleAccept = (withAnalytics: boolean) => {
    const consent: CookieConsent = {
      essential: true,
      analytics: withAnalytics,
      version: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));

    // Sync consent to server for authenticated users (ADR-013 Section 4)
    // This is fire-and-forget; failure does not block the UI
    syncConsentToServer(consent);

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t('consent.bannerLabel')}
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            {t('consent.description')}
            {' '}
            <a href="/privacy/policy" className="underline text-blue-600">
              {t('consent.privacyPolicyLink')}
            </a>
          </p>
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              aria-describedby="analytics-description"
            />
            <span id="analytics-description">
              {t('consent.analyticsLabel')}
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleAccept(false)}
            className="px-4 py-2 border rounded text-sm"
          >
            {t('consent.essentialOnly')}
          </button>
          <button
            onClick={() => handleAccept(analyticsEnabled)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
          >
            {t('consent.acceptSelected')}
          </button>
        </div>
      </div>
    </div>
  );
}

async function syncConsentToServer(consent: CookieConsent): Promise<void> {
  try {
    const { apiClient } = await import('../../../api/client');
    await apiClient.patch('/users/me/consents', {
      cookieAnalytics: consent.analytics,
      consentVersion: consent.version,
    });
  } catch {
    // Consent sync failure is non-blocking
  }
}
```

#### Data Export Request

```typescript
// apps/web/src/features/privacy/hooks/useDataExport.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { useToastStore } from '../../../stores/toast.store';

export function useDataExport() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: async () => {
      // Returns 202 Accepted (ADR-013 Section 3)
      const { data } = await apiClient.get('/users/me/data-export');
      return data;
    },
    onSuccess: () => {
      addToast({
        severity: 'success',
        messageKey: 'privacy.export.requested',
        duration: 5000,
      });
    },
    onError: () => {
      addToast({
        severity: 'error',
        messageKey: 'privacy.export.failed',
        duration: 5000,
      });
    },
  });
}
```

#### Account Deletion Flow

```
User clicks "Delete my account" in /privacy/delete-account
       |
       v
  [Confirmation modal with warning text]
       |
       v
  [User types their email to confirm]
       |
       v
  POST /api/v1/users/me/erasure-request
       |
       +-- 202 Accepted -> Show "request submitted" message
       |                    Log user out
       |                    Redirect to goodbye page
       |
       +-- Error -> Show error in modal
```

This flow aligns with the erasure command in ADR-013 Section 2.

---

### 15. Testing Strategy

#### Testing Pyramid

```
+-----------------------------------------------------------------------+
|                         Testing Pyramid                                |
+-----------------------------------------------------------------------+
|                                                                        |
|                          E2E Tests                                     |
|                       (Playwright)                                     |
|                     ~20 critical paths                                  |
|                   /                      \                              |
|                  /    Integration Tests    \                            |
|                 /   (Vitest + RTL + MSW)    \                          |
|                /      ~100 per feature       \                         |
|               /                                \                       |
|              /         Unit Tests               \                      |
|             /       (Vitest + RTL)               \                     |
|            /         ~200 per feature             \                    |
|           /____________________________________________\               |
|                                                                        |
+-----------------------------------------------------------------------+
```

#### Tool Responsibilities

| Layer       | Tool                         | Scope                              | Speed     |
|-------------|------------------------------|-------------------------------------|-----------|
| Unit        | Vitest                       | Pure functions, hooks, stores       | < 1ms/test |
| Component   | Vitest + React Testing Library | Single component render + behavior | < 50ms/test |
| Integration | Vitest + RTL + MSW           | Multi-component with mocked API    | < 200ms/test |
| E2E         | Playwright                   | Full browser, real server or MSW   | 2-10s/test |
| Visual      | Playwright screenshots        | Component visual regression        | 1-3s/test |

#### MSW (Mock Service Worker) Setup

All API calls in tests are intercepted at the network level by MSW, ensuring tests exercise the full Axios interceptor pipeline without hitting a real backend.

```typescript
// apps/web/src/test/mocks/handlers.ts

import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === 'test@example.com' && body.password === 'Password1!') {
      return HttpResponse.json({
        success: true,
        data: { accessToken: 'mock-access-token' },
      });
    }
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString(),
          requestId: 'test-req-1',
        },
      },
      { status: 401 }
    );
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      success: true,
      data: { accessToken: 'mock-refreshed-token' },
    });
  }),

  // Feed endpoint
  http.get('/api/v1/feed', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'post-1', content: 'Hello world', author: { displayName: 'Test User' } },
      ],
      meta: { cursor: null, hasMore: false, limit: 20 },
    });
  }),

  // Users endpoint
  http.get('/api/v1/users/me', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        displayName: 'Test User',
        avatarUrl: null,
      },
    });
  }),
];
```

#### Test Organization

```
apps/web/
+-- src/
|   +-- features/
|   |   +-- auth/
|   |   |   +-- __tests__/
|   |   |       +-- LoginForm.test.tsx        # Component test
|   |   |       +-- useLogin.test.ts          # Hook unit test
|   |   |       +-- login-flow.integration.test.tsx  # Integration test
|   |   +-- feed/
|   |   |   +-- __tests__/
|   |   |       +-- FeedList.test.tsx
|   |   |       +-- useFeed.test.ts
|   |   |       +-- useReaction.test.ts
|   |   +-- ...
|   +-- shared/
|   |   +-- __tests__/
|   |       +-- error-boundary.test.tsx
|   |       +-- ProtectedRoute.test.tsx
|   +-- stores/
|   |   +-- __tests__/
|   |       +-- auth.store.test.ts
|   |       +-- ui.store.test.ts
|   +-- socket/
|       +-- __tests__/
|           +-- event-invalidation.test.ts
|
+-- e2e/                                      # Playwright E2E tests
    +-- auth.spec.ts                          # Login, register, logout
    +-- feed.spec.ts                          # Feed browsing, post creation
    +-- social.spec.ts                        # Follow, block
    +-- groups.spec.ts                        # Group CRUD, membership
    +-- notifications.spec.ts                 # Notification display, mark-read
    +-- privacy.spec.ts                       # Cookie consent, data export, deletion
    +-- admin.spec.ts                         # Admin dashboard, audit log
    +-- a11y.spec.ts                          # Accessibility audit via axe-core
```

#### Coverage Targets

| Metric              | Target  | Enforcement        |
|---------------------|---------|--------------------|
| Line coverage       | > 80%   | CI gate (Vitest)   |
| Branch coverage     | > 75%   | CI gate (Vitest)   |
| Critical path E2E   | 100%    | CI gate (Playwright) |
| Accessibility       | 0 violations | CI gate (axe-core) |

---

### 16. Performance Strategy

#### Performance Targets

| Metric                   | Target        | Measurement Tool         |
|--------------------------|---------------|--------------------------|
| First Contentful Paint   | < 1.5s        | Lighthouse, Web Vitals   |
| Largest Contentful Paint | < 2.5s        | Lighthouse, Web Vitals   |
| Time to Interactive      | < 3.0s        | Lighthouse               |
| Cumulative Layout Shift  | < 0.1         | Lighthouse, Web Vitals   |
| Initial Bundle Size      | < 200 KB (gz) | Vite build stats         |
| Lighthouse Performance   | > 90          | Lighthouse CI            |

#### Optimization Strategies

1. **Code splitting**: Route-level lazy loading reduces initial bundle. Each bounded context feature is a separate chunk.
2. **Tree shaking**: Vite + ESBuild eliminates unused code paths.
3. **Image optimization**: Lazy loading via `loading="lazy"`, WebP/AVIF formats, CDN delivery via the file storage architecture (ADR-015).
4. **Query prefetching**: Prefetch likely-next-page queries on link hover using `queryClient.prefetchQuery()`.
5. **Font loading**: `font-display: swap` to avoid blocking render.
6. **Virtual scrolling**: The feed and notification lists use virtual scrolling (e.g., `@tanstack/react-virtual`) to render only visible items, supporting feeds with thousands of items without DOM bloat.
7. **Service worker**: A service worker caches static assets (JS, CSS, fonts, images) using a cache-first strategy for offline resilience and faster repeat visits. API responses are NOT cached by the service worker (TanStack Query handles API caching).

#### Virtual Scrolling for Feed

```typescript
// apps/web/src/features/feed/components/FeedList.tsx (simplified)

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';
import { useFeed } from '../hooks/useFeed';
import { PostCard } from './PostCard';

export function FeedList() {
  const parentRef = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();

  const allPosts = data?.pages.flatMap((page) => page.data) ?? [];

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,  // Estimated post card height in px
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  // Trigger fetch when scrolling near the end
  const lastItem = items[items.length - 1];
  if (lastItem && lastItem.index >= allPosts.length - 1 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  return (
    <div
      ref={parentRef}
      className="h-screen overflow-auto"
      role="feed"
      aria-label="Main feed"
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {items.map((virtualItem) => {
          const post = allPosts[virtualItem.index];
          if (!post) {
            return (
              <div
                key="loader"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <span role="status">Loading more posts...</span>
              </div>
            );
          }
          return (
            <article
              key={post.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              aria-posinset={virtualItem.index + 1}
              aria-setsize={allPosts.length}
            >
              <PostCard post={post} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
```

#### Service Worker Registration

```typescript
// apps/web/src/main.tsx (excerpt)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
```

---

### 17. Observability Integration (ADR-012 Alignment)

The frontend reports performance metrics and errors to the backend observability pipeline.

#### Web Vitals Reporting

```typescript
// apps/web/src/shared/utils/web-vitals.ts

import { onFCP, onLCP, onCLS, onINP, onTTFB } from 'web-vitals';

function sendMetric(metric: { name: string; value: number; id: string }) {
  if (import.meta.env.PROD) {
    navigator.sendBeacon(
      '/api/v1/telemetry/web-vitals',
      JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
      })
    );
  }
}

export function initWebVitals(): void {
  onFCP(sendMetric);
  onLCP(sendMetric);
  onCLS(sendMetric);
  onINP(sendMetric);
  onTTFB(sendMetric);
}
```

#### Request Tracing

The Axios client attaches a `X-Request-ID` header to every request. This ID is generated client-side and can be correlated with server-side traces (ADR-012).

```typescript
// Added to apiClient interceptors
apiClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});
```

---

## Alternatives Considered

### Option A: Next.js with App Router (Rejected)

**Implementation**: Next.js App Router with React Server Components.

**Pros**:
- Server-side rendering for improved SEO
- Built-in code splitting and image optimization
- API routes could colocate backend-for-frontend (BFF) logic
- React Server Components reduce client-side JavaScript

**Cons**:
- **Architectural mismatch**: The backend is a standalone NestJS modular monolith (ADR-002). Adding an SSR layer introduces a second server runtime with its own deployment, scaling, and monitoring concerns.
- **Complexity**: React Server Components and client/server boundaries add cognitive overhead for a primarily interactive SPA. The team would need to reason about which components run on the server vs the client.
- **SEO not critical**: Social network content is gated behind authentication. Public pages (landing, about, privacy policy) are minimal and can use static HTML or Vite prerendering.
- **WebSocket complexity**: Socket.IO real-time subscriptions are client-only. Server components cannot hold WebSocket connections, requiring all real-time features to be client components anyway.
- **Deployment cost**: An SSR server adds another deployment target, health check surface, and scaling dimension alongside the existing NestJS API.

**Why Rejected**: SSR adds significant infrastructure and cognitive complexity without clear benefit for an authenticated SPA. Vite with client-side React is simpler, faster to iterate on, and sufficient for the use case. If SEO becomes a requirement for public content in the future, a separate lightweight prerendering layer can be added.

### Option B: Redux Toolkit + RTK Query (Rejected)

**Implementation**: Redux Toolkit with RTK Query for server state, Redux slices for client state.

**Pros**:
- Single store for all state (server and client)
- RTK Query handles caching, deduplication, and polling
- Large ecosystem and extensive community resources
- Redux DevTools for debugging

**Cons**:
- **Boilerplate**: Slices, reducers, actions, and selectors for every feature. Even with RTK's createSlice and createApi, the ceremony is substantially higher than Zustand + TanStack Query.
- **Server state mismatch**: Redux was designed for client state. RTK Query bolts on server state but duplicates what TanStack Query does natively (background refetch, garbage collection, optimistic updates, infinite queries).
- **Bundle size**: Redux Toolkit (~15 KB gz) + RTK Query (~13 KB gz) = ~28 KB. Compare with Zustand (~1 KB gz) + TanStack Query (~13 KB gz) = ~14 KB. The chosen stack is half the size.
- **Conceptual overhead**: Developers must learn Redux concepts (actions, reducers, middleware, selectors, normalized state) in addition to RTK Query's own API. TanStack Query has a simpler mental model for server state.

**Why Rejected**: TanStack Query is purpose-built for server state management. It handles caching, background refetch, optimistic updates, pagination, and garbage collection without Redux ceremony. Zustand handles the small amount of remaining client state (auth, UI preferences, toasts) with a minimal API surface. The combination is lighter, simpler, and more focused.

### Option C: SWR (Rejected)

**Implementation**: Vercel's SWR library for data fetching.

**Pros**:
- Simple stale-while-revalidate API
- Lightweight (~4 KB gz)
- Good defaults for simple fetch patterns

**Cons**:
- **Weaker mutation support**: SWR's `useSWRMutation` is less mature than TanStack Query's `useMutation` with built-in optimistic updates, rollback context, and settled callbacks.
- **No built-in infinite queries**: Cursor-based pagination (used for feed, notifications, comments) requires manual implementation with `useSWRInfinite`, which lacks the ergonomics of `useInfiniteQuery`.
- **Fewer DevTools**: TanStack Query DevTools provide cache visualization, query state inspection, and manual invalidation. SWR has no official DevTools.
- **Cache invalidation granularity**: SWR's `mutate` function operates on exact keys or regex patterns. TanStack Query's `invalidateQueries` supports hierarchical key matching (e.g., invalidate all queries starting with `['posts', postId]`), which aligns well with the nested resource API design.

**Why Rejected**: The application requires robust mutation handling (optimistic reactions, follows, post creation), infinite scroll, and fine-grained cache invalidation, all of which TanStack Query handles natively.

### Option D: Vue.js 3 / Angular (Rejected)

**Implementation**: Vue 3 with Composition API + Pinia, or Angular 17+ with signals.

**Pros**:
- Vue: Simpler template syntax, good reactivity system, smaller learning curve
- Angular: Enterprise-grade, built-in DI, RxJS for real-time patterns

**Cons**:
- **React ecosystem is larger**: More third-party libraries, more community resources, more hiring pool
- **Team familiarity**: The team has production React experience. Switching frameworks for the same capability set introduces unnecessary ramp-up time.
- **TanStack Query integration**: TanStack Query has first-class React support. Vue and Angular adapters exist but are less mature.

**Why Rejected**: React provides the best combination of team familiarity, ecosystem breadth, and tooling support for this project's requirements.

---

## Consequences

### Positive

- **Type Safety End-to-End**: Generated API client ensures frontend types match backend contracts. Breaking changes are caught at build time, not at runtime.
- **Clear Cache Ownership**: TanStack Query owns all server state with explicit stale times, GC times, and invalidation rules per domain. No stale data ambiguity.
- **Real-Time Consistency**: WebSocket events automatically invalidate relevant caches, keeping the UI fresh without manual refetching. The event-to-invalidation mapping table provides a clear contract between frontend and backend.
- **Bounded Context Alignment**: Feature modules mirror backend contexts (ADR-007), making it easy to reason about where code lives. A developer working on groups knows to look in `features/groups/`.
- **Performance by Default**: Code splitting, lazy loading, virtual scrolling, and efficient caching ensure fast load times without manual optimization on a per-feature basis.
- **Small Bundle**: Zustand (~1 KB gz) + TanStack Query (~13 KB gz) is significantly smaller than Redux Toolkit (~15 KB gz) + RTK Query (~13 KB gz), saving ~14 KB of JavaScript.
- **Accessible from Day One**: WCAG 2.1 AA compliance is enforced via linting rules, semantic HTML patterns, and automated testing, preventing accessibility debt.
- **Privacy Compliance**: GDPR UI flows (cookie consent, data export, account deletion) are built into the architecture rather than bolted on later.
- **Comprehensive Testing**: Four-layer testing strategy (unit, component, integration, E2E) with MSW for realistic API mocking provides high confidence in releases.

### Negative

- **Code Generation Dependency**: Frontend builds depend on a current OpenAPI spec from the backend. Stale or missing specs cause type mismatches and build failures.
- **Multiple State Layers**: Developers must understand when to use TanStack Query (server data) vs Zustand (client data) vs React Hook Form (form data) vs component state (ephemeral UI).
- **Socket.IO Complexity**: The event-to-invalidation mapping must be maintained in sync with backend domain events (ADR-009). New events require frontend mapping updates.
- **No SSR**: Public-facing pages (landing, about, privacy policy) lack server-side rendering for SEO. If public content becomes a requirement, additional infrastructure is needed.
- **i18n Maintenance**: Translation files for each namespace and language must be kept in sync. Missing translations fall back to English but degrade the localized experience.
- **Testing Overhead**: Four testing layers require more setup and maintenance than a simpler strategy. MSW handlers must be kept in sync with real API responses.

### Mitigation

| Risk | Mitigation |
|------|------------|
| Stale OpenAPI spec | CI step regenerates client and fails build on type errors. OpenAPI spec is committed to the monorepo and updated alongside API changes. |
| State layer confusion | State ownership table documented in this ADR. ESLint rule forbids importing server data into Zustand stores. |
| Event mapping drift | Shared event type constants in `libs/shared/types/` (monorepo). CI test verifies all event types in ADR-009 catalog have a corresponding frontend mapping. |
| SEO for public pages | Prerender static pages (landing, about, privacy policy) at build time with `vite-plugin-ssr` or deploy as static HTML. |
| Missing translations | CI step runs `i18next-parser` to detect untranslated keys. Fallback language (English) ensures functional UI even with gaps. |
| MSW handler staleness | MSW handlers are generated from the same OpenAPI spec used for the API client. A shared test fixture library ensures consistency. |

---

## References

- TanStack Query Documentation: https://tanstack.com/query/latest
- Zustand Documentation: https://zustand-demo.pmnd.rs/
- Vite Documentation: https://vitejs.dev/
- Socket.IO Client Documentation: https://socket.io/docs/v4/client-api/
- Orval (OpenAPI Client Generator): https://orval.dev/
- React Router v6: https://reactrouter.com/
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- Tailwind CSS: https://tailwindcss.com/
- i18next: https://www.i18next.com/
- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/
- MSW (Mock Service Worker): https://mswjs.io/
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- eslint-plugin-jsx-a11y: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- web-vitals: https://github.com/GoogleChrome/web-vitals
- @tanstack/react-virtual: https://tanstack.com/virtual/latest
- ADR-003: REST API Design (`docs/adr/ADR-003-rest-vs-graphql.md`)
- ADR-004: JWT Authentication (`docs/adr/ADR-004-session-vs-token-auth.md`)
- ADR-007: Bounded Contexts (`docs/adr/ADR-007-bounded-contexts-definition.md`)
- ADR-009: Domain Events (`docs/adr/ADR-009-domain-events-strategy.md`)
- ADR-012: Observability Strategy (`docs/adr/ADR-012-observability-strategy.md`)
- ADR-013: Data Privacy and GDPR (`docs/adr/ADR-013-data-privacy-gdpr.md`)
- ADR-015: File Storage Architecture (`docs/adr/ADR-015-file-storage-architecture.md`)
