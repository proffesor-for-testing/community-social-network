import React, { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  type RouteObject,
} from 'react-router-dom';
import { AuthLayout } from './shared/layouts/AuthLayout';
import { AppLayout } from './shared/layouts/AppLayout';
import { ProtectedRoute } from './shared/components/organisms/ProtectedRoute';
import { authRoutes } from './features/auth/routes';
import { feedRoutes } from './features/feed/routes';
import { profileRoutes } from './features/profile/routes';
import { socialRoutes } from './features/social/routes';
import { groupRoutes } from './features/groups/routes';
import { notificationRoutes } from './features/notifications/routes';
import { adminRoutes } from './features/admin/routes';
import { Spinner } from './shared/components/atoms/Spinner';
import { ErrorBoundary } from './shared/error-boundary';

// ── Lazy-loaded page shells (kept for standalone pages) ──────────

const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ── Suspense wrapper ─────────────────────────────────────────────

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// ── Route tree ───────────────────────────────────────────────────

const routes: RouteObject[] = [
  // Public auth routes
  {
    element: <AuthLayout />,
    children: authRoutes,
  },

  // Protected application routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <ErrorBoundary><></></ErrorBoundary>,
        children: [
          // Feed routes (index + post detail)
          ...feedRoutes,

          // Profile routes
          ...profileRoutes,

          // Social / connections routes
          ...socialRoutes,

          // Community / groups routes
          ...groupRoutes,

          // Notification routes
          ...notificationRoutes,

          // Admin routes
          ...adminRoutes,

          // Standalone pages
          {
            path: 'explore',
            element: (
              <PageSuspense>
                <ExplorePage />
              </PageSuspense>
            ),
          },
          {
            path: 'messages',
            element: (
              <PageSuspense>
                <MessagesPage />
              </PageSuspense>
            ),
          },
          {
            path: 'settings',
            element: (
              <PageSuspense>
                <SettingsPage />
              </PageSuspense>
            ),
          },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: (
      <PageSuspense>
        <NotFoundPage />
      </PageSuspense>
    ),
  },
];

export const router = createBrowserRouter(routes);
