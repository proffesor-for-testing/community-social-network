import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';

const NotificationListLazy = lazy(() =>
  import('./components/NotificationList').then((m) => ({ default: m.NotificationList })),
);
const NotificationPreferencesLazy = lazy(() =>
  import('./components/NotificationPreferences').then((m) => ({
    default: m.NotificationPreferences,
  })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export const notificationRoutes: RouteObject[] = [
  {
    path: 'notifications',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <NotificationListLazy />
          </Suspense>
        ),
      },
      {
        path: 'preferences',
        element: (
          <Suspense fallback={<Fallback />}>
            <NotificationPreferencesLazy />
          </Suspense>
        ),
      },
    ],
  },
];
