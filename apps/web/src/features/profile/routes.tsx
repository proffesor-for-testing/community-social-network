import React, { lazy, Suspense } from 'react';
import { useParams, type RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';

const ProfileHeaderLazy = lazy(() =>
  import('./components/ProfileHeader').then((m) => ({ default: m.ProfileHeader })),
);
const ProfileSettingsLazy = lazy(() =>
  import('./components/ProfileSettings').then((m) => ({ default: m.ProfileSettings })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

/** Wrapper that extracts memberId param and passes it to ProfileHeader */
function ProfileViewPage() {
  const { memberId } = useParams<{ memberId: string }>();
  return (
    <Suspense fallback={<Fallback />}>
      <ProfileHeaderLazy memberId={memberId} />
    </Suspense>
  );
}

export const profileRoutes: RouteObject[] = [
  {
    path: 'profile',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <ProfileHeaderLazy />
          </Suspense>
        ),
      },
      {
        path: ':memberId',
        element: <ProfileViewPage />,
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Fallback />}>
            <ProfileSettingsLazy />
          </Suspense>
        ),
      },
    ],
  },
];
