import React, { lazy, Suspense, useState } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';
import { useAuthStore } from '../../stores/auth.store';

const FollowersListLazy = lazy(() =>
  import('./components/FollowersList').then((m) => ({ default: m.FollowersList })),
);
const FollowingListLazy = lazy(() =>
  import('./components/FollowingList').then((m) => ({ default: m.FollowingList })),
);
const BlockedListLazy = lazy(() =>
  import('./components/BlockedList').then((m) => ({ default: m.BlockedList })),
);
const PendingRequestsLazy = lazy(() =>
  import('./components/PendingRequests').then((m) => ({ default: m.PendingRequests })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

/**
 * Overview page showing pending requests, followers, and following tabs.
 */
function ConnectionsOverview() {
  const [tab, setTab] = useState<'pending' | 'followers' | 'following'>('pending');
  const memberId = useAuthStore((s) => s.user?.id) ?? '';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Connections
      </h1>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-surface-dark-tertiary">
        {(['pending', 'followers', 'following'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white text-gray-900 shadow-sm dark:bg-surface-dark-secondary dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Suspense fallback={<Fallback />}>
        {tab === 'pending' && <PendingRequestsLazy />}
        {tab === 'followers' && memberId && <FollowersListLazy memberId={memberId} />}
        {tab === 'following' && memberId && <FollowingListLazy memberId={memberId} />}
      </Suspense>
    </div>
  );
}

export const socialRoutes: RouteObject[] = [
  {
    path: 'connections',
    children: [
      {
        index: true,
        element: <ConnectionsOverview />,
      },
      {
        path: 'blocked',
        element: (
          <Suspense fallback={<Fallback />}>
            <BlockedListLazy />
          </Suspense>
        ),
      },
    ],
  },
];
