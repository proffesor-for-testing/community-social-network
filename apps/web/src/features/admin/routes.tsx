import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';

const DashboardLazy = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const AuditLogLazy = lazy(() =>
  import('./components/AuditLog').then((m) => ({ default: m.AuditLog })),
);
const UserManagementLazy = lazy(() =>
  import('./components/UserManagement').then((m) => ({ default: m.UserManagement })),
);
const SecurityAlertsLazy = lazy(() =>
  import('./components/SecurityAlerts').then((m) => ({ default: m.SecurityAlerts })),
);
const TwoFactorSetupLazy = lazy(() =>
  import('./components/TwoFactorSetup').then((m) => ({ default: m.TwoFactorSetup })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <DashboardLazy />
          </Suspense>
        ),
      },
      {
        path: 'audit',
        element: (
          <Suspense fallback={<Fallback />}>
            <AuditLogLazy />
          </Suspense>
        ),
      },
      {
        path: 'users',
        element: (
          <Suspense fallback={<Fallback />}>
            <UserManagementLazy />
          </Suspense>
        ),
      },
      {
        path: 'security',
        element: (
          <Suspense fallback={<Fallback />}>
            <SecurityAlertsLazy />
          </Suspense>
        ),
      },
      {
        path: '2fa',
        element: (
          <Suspense fallback={<Fallback />}>
            <TwoFactorSetupLazy />
          </Suspense>
        ),
      },
    ],
  },
];
