import type { RouteObject } from 'react-router-dom';

/**
 * Comments are displayed inline within post detail pages, not as standalone routes.
 * This file exports an empty array for consistency with the feature module pattern.
 * The CommentThread and CommentForm components are consumed directly by PostDetail.
 */
export const commentRoutes: RouteObject[] = [];
