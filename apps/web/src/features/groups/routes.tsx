import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';

const GroupListPage = lazy(() =>
  import('./components/GroupListPage').then((m) => ({ default: m.GroupListPage })),
);
const GroupDetailLazy = lazy(() =>
  import('./components/GroupDetail').then((m) => ({ default: m.GroupDetail })),
);
const GroupSettingsLazy = lazy(() =>
  import('./components/GroupSettings').then((m) => ({ default: m.GroupSettings })),
);
const CreateGroupFormLazy = lazy(() =>
  import('./components/CreateGroupForm').then((m) => ({ default: m.CreateGroupForm })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export const groupRoutes: RouteObject[] = [
  {
    path: 'communities',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <GroupListPage />
          </Suspense>
        ),
      },
      {
        path: 'new',
        element: (
          <Suspense fallback={<Fallback />}>
            <CreateGroupFormLazy />
          </Suspense>
        ),
      },
      {
        path: ':groupId',
        element: (
          <Suspense fallback={<Fallback />}>
            <GroupDetailLazy />
          </Suspense>
        ),
      },
      {
        path: ':groupId/settings',
        element: (
          <Suspense fallback={<Fallback />}>
            <GroupSettingsLazy />
          </Suspense>
        ),
      },
    ],
  },
];
