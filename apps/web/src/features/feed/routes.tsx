import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from '../../shared/components/atoms/Spinner';

const FeedListLazy = lazy(() =>
  import('./components/FeedList').then((m) => ({ default: m.FeedList })),
);
const CreatePostFormLazy = lazy(() =>
  import('./components/CreatePostForm').then((m) => ({ default: m.CreatePostForm })),
);
const PostDetailLazy = lazy(() =>
  import('./components/PostDetail').then((m) => ({ default: m.PostDetail })),
);

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function FeedPageContent() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Fallback />}>
        <CreatePostFormLazy />
      </Suspense>
      <Suspense fallback={<Fallback />}>
        <FeedListLazy />
      </Suspense>
    </div>
  );
}

export const feedRoutes: RouteObject[] = [
  {
    index: true,
    element: <FeedPageContent />,
  },
  {
    path: 'posts/:postId',
    element: (
      <Suspense fallback={<Fallback />}>
        <PostDetailLazy />
      </Suspense>
    ),
  },
];
