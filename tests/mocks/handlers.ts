/**
 * MSW Request Handlers
 *
 * Mock Service Worker handlers matching the API endpoints defined
 * across all 7 bounded contexts. These handlers are used in frontend
 * tests and Storybook to simulate backend responses without a running
 * API server.
 *
 * NOTE: MSW must be installed separately (`npm install msw --save-dev`).
 * These handlers are structured to work with MSW v2 syntax.
 *
 * Endpoint coverage:
 * - Identity: register, login, refresh, logout, me
 * - Profile: get, update, upload-avatar
 * - Content: posts (CRUD), comments, reactions, feed
 * - Social Graph: follow, unfollow, approve, reject, followers, following, pending, blocks
 * - Community: groups (CRUD), join, leave, members, roles, kick
 * - Notification: list, mark-read, mark-all-read, unread-count, preferences
 * - Admin: login, 2fa, users, suspend, unsuspend, audit-log, security-alerts
 */
import { randomUUID } from 'crypto';

// ── Types for MSW v2 ────────────────────────────────────────────────────────
// If MSW is not installed, these types prevent build errors. The file
// becomes a no-op in that case.

type HttpHandler = {
  method: string;
  path: string;
  resolver: (...args: unknown[]) => unknown;
};

// ── Helper ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

const now = () => new Date().toISOString();

// ── Default test data ───────────────────────────────────────────────────────

const testMember = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'testuser@example.com',
  displayName: 'Test User',
  status: 'ACTIVE',
  createdAt: now(),
};

const testToken = {
  accessToken: 'mock-access-token-for-testing',
  refreshToken: 'mock-refresh-token-for-testing',
  member: testMember,
};

const testPost = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  authorId: testMember.id,
  content: 'Hello world! This is a test post.',
  visibility: 'PUBLIC',
  status: 'PUBLISHED',
  reactionCounts: { LIKE: 5, LOVE: 2 },
  commentCount: 3,
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const testGroup = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  name: 'Test Group',
  description: 'A group for testing.',
  ownerId: testMember.id,
  memberCount: 1,
  status: 'ACTIVE',
  settings: {
    isPublic: true,
    requireApproval: false,
    allowMemberPosts: true,
  },
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const testConnection = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  followerId: testMember.id,
  followeeId: randomUUID(),
  status: 'ACCEPTED',
  createdAt: now(),
  ...overrides,
});

const testNotification = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  recipientId: testMember.id,
  type: 'FOLLOW',
  title: 'New follower',
  message: 'Someone started following you.',
  link: '/social/followers',
  status: 'UNREAD',
  createdAt: now(),
  ...overrides,
});

// ── Handler definitions ─────────────────────────────────────────────────────

/**
 * Raw handler definitions (method, path, response factory).
 * When MSW is available, these are converted to http.method() calls.
 * When MSW is not available, they serve as documentation of the API surface.
 */
export const handlerDefinitions = [
  // ─── Identity ──────────────────────────────────────────────────────
  { method: 'POST', path: '/api/auth/register', response: () => json(testToken, 201) },
  { method: 'POST', path: '/api/auth/login', response: () => json(testToken) },
  { method: 'POST', path: '/api/auth/refresh', response: () => json(testToken) },
  { method: 'POST', path: '/api/auth/logout', response: () => json(null, 204) },
  { method: 'GET', path: '/api/auth/me', response: () => json(testMember) },

  // ─── Profile ───────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/profiles/:id',
    response: () => json({
      id: randomUUID(),
      memberId: testMember.id,
      displayName: testMember.displayName,
      email: testMember.email,
      bio: 'Hello, I am a test user.',
      avatarUrl: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
  {
    method: 'GET',
    path: '/api/profiles/member/:memberId',
    response: () => json({
      id: randomUUID(),
      memberId: testMember.id,
      displayName: testMember.displayName,
      email: testMember.email,
      bio: '',
      avatarUrl: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  },
  { method: 'PUT', path: '/api/profiles/:id', response: () => json({ success: true }) },
  { method: 'POST', path: '/api/profiles/:id/avatar', response: () => json({ avatarUrl: '/uploads/avatar.jpg' }) },

  // ─── Content: Posts ────────────────────────────────────────────────
  { method: 'POST', path: '/api/posts', response: () => json({ id: randomUUID() }, 201) },
  { method: 'GET', path: '/api/posts/:id', response: () => json(testPost()) },
  { method: 'PUT', path: '/api/posts/:id', response: () => json({ success: true }) },
  { method: 'DELETE', path: '/api/posts/:id', response: () => json(null, 204) },
  {
    method: 'GET',
    path: '/api/feed',
    response: () => json({
      items: [testPost(), testPost(), testPost()],
      cursor: randomUUID(),
      hasMore: true,
    }),
  },

  // ─── Content: Comments ─────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/posts/:postId/comments',
    response: () => json({
      id: randomUUID(),
      publicationId: randomUUID(),
      authorId: testMember.id,
      content: 'Great post!',
      status: 'ACTIVE',
      createdAt: now(),
    }, 201),
  },
  {
    method: 'GET',
    path: '/api/posts/:postId/comments',
    response: () => json({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    }),
  },

  // ─── Content: Reactions ────────────────────────────────────────────
  { method: 'POST', path: '/api/posts/:postId/reactions', response: () => json(null, 201) },
  { method: 'DELETE', path: '/api/posts/:postId/reactions', response: () => json(null, 204) },
  { method: 'POST', path: '/api/comments/:commentId/reactions', response: () => json(null, 201) },

  // ─── Social Graph: Connections ─────────────────────────────────────
  { method: 'POST', path: '/api/connections/follow/:userId', response: () => json(testConnection({ status: 'PENDING' }), 201) },
  { method: 'DELETE', path: '/api/connections/follow/:userId', response: () => json(null, 204) },
  { method: 'POST', path: '/api/connections/approve/:connectionId', response: () => json(testConnection({ status: 'ACCEPTED' })) },
  { method: 'POST', path: '/api/connections/reject/:connectionId', response: () => json(null) },
  {
    method: 'GET',
    path: '/api/connections/followers',
    response: () => json({ items: [testConnection()], total: 1, cursor: null }),
  },
  {
    method: 'GET',
    path: '/api/connections/following',
    response: () => json({ items: [testConnection()], total: 1, cursor: null }),
  },
  {
    method: 'GET',
    path: '/api/connections/pending',
    response: () => json({ items: [], total: 0, cursor: null }),
  },

  // ─── Social Graph: Blocks ─────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/blocks/:userId',
    response: () => json({
      id: randomUUID(),
      blockerId: testMember.id,
      blockedId: randomUUID(),
      createdAt: now(),
    }, 201),
  },
  { method: 'DELETE', path: '/api/blocks/:userId', response: () => json(null, 204) },
  { method: 'GET', path: '/api/blocks', response: () => json([]) },

  // ─── Community: Groups ─────────────────────────────────────────────
  { method: 'POST', path: '/api/groups', response: () => json(testGroup(), 201) },
  { method: 'GET', path: '/api/groups/search', response: () => json({ items: [testGroup()], total: 1, page: 1, pageSize: 20, totalPages: 1 }) },
  { method: 'GET', path: '/api/groups/:id', response: () => json(testGroup()) },
  { method: 'PUT', path: '/api/groups/:id', response: () => json(testGroup()) },
  { method: 'DELETE', path: '/api/groups/:id', response: () => json(null, 204) },
  {
    method: 'POST',
    path: '/api/groups/:id/join',
    response: () => json({
      id: randomUUID(),
      groupId: randomUUID(),
      memberId: testMember.id,
      role: 'MEMBER',
      joinedAt: now(),
    }, 201),
  },
  { method: 'POST', path: '/api/groups/:id/leave', response: () => json(null, 204) },
  {
    method: 'GET',
    path: '/api/groups/:id/members',
    response: () => json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
  },
  {
    method: 'PUT',
    path: '/api/groups/:id/members/:memberId/role',
    response: () => json({
      id: randomUUID(),
      groupId: randomUUID(),
      memberId: randomUUID(),
      role: 'ADMIN',
      joinedAt: now(),
    }),
  },
  { method: 'DELETE', path: '/api/groups/:id/members/:memberId', response: () => json(null, 204) },

  // ─── Notification ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/notifications',
    response: () => json({
      items: [testNotification()],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
  },
  { method: 'POST', path: '/api/notifications/:id/read', response: () => json({ success: true }) },
  { method: 'POST', path: '/api/notifications/read-all', response: () => json({ success: true }) },
  { method: 'GET', path: '/api/notifications/unread-count', response: () => json({ count: 5 }) },
  {
    method: 'GET',
    path: '/api/notifications/preferences',
    response: () => json({
      email: true,
      push: true,
      inApp: true,
      follows: true,
      likes: true,
      comments: true,
      mentions: true,
    }),
  },
  { method: 'PUT', path: '/api/notifications/preferences', response: () => json({ success: true }) },

  // ─── Admin ─────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/admin/auth/login', response: () => json({ token: 'admin-mock-token', requiresTwoFactor: false }) },
  { method: 'POST', path: '/api/admin/auth/2fa/setup', response: () => json({ secret: 'MOCK2FASECRET', qrCodeUrl: 'https://example.com/qr' }) },
  { method: 'POST', path: '/api/admin/auth/2fa/verify', response: () => json({ verified: true, token: 'admin-2fa-token' }) },
  {
    method: 'GET',
    path: '/api/admin/users',
    response: () => json({
      items: [{ ...testMember, failedLoginAttempts: 0, lastLoginAt: now() }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
  },
  {
    method: 'POST',
    path: '/api/admin/users/:userId/suspend',
    response: () => json({ ...testMember, status: 'SUSPENDED', failedLoginAttempts: 0, lastLoginAt: now() }),
  },
  {
    method: 'POST',
    path: '/api/admin/users/:userId/unsuspend',
    response: () => json({ ...testMember, status: 'ACTIVE', failedLoginAttempts: 0, lastLoginAt: now() }),
  },
  {
    method: 'GET',
    path: '/api/admin/audit-log',
    response: () => json({
      items: [{
        id: randomUUID(),
        action: 'SUSPEND_USER',
        performedBy: randomUUID(),
        targetId: testMember.id,
        targetType: 'Member',
        details: { reason: 'Test' },
        ipAddress: '127.0.0.1',
        createdAt: now(),
      }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
  },
  {
    method: 'GET',
    path: '/api/admin/security-alerts',
    response: () => json({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    }),
  },

  // ─── Privacy ───────────────────────────────────────────────────────
  { method: 'GET', path: '/api/privacy/data-export', response: () => json({ status: 'pending', requestId: randomUUID() }) },
  { method: 'DELETE', path: '/api/privacy/account', response: () => json(null, 204) },

  // ─── Upload ────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/upload', response: () => json({ url: '/uploads/file.jpg', filename: 'file.jpg' }, 201) },

  // ─── Health ────────────────────────────────────────────────────────
  { method: 'GET', path: '/health', response: () => json({ status: 'ok', timestamp: now() }) },
];

/**
 * Export the handler definitions. When MSW is installed, use them like:
 *
 * ```ts
 * import { http, HttpResponse } from 'msw';
 * import { handlerDefinitions } from './handlers';
 *
 * const handlers = handlerDefinitions.map(def =>
 *   http[def.method.toLowerCase()](`http://localhost:3000${def.path}`, () => {
 *     const res = def.response();
 *     return HttpResponse.json(JSON.parse(res.body ?? 'null'), { status: res.status });
 *   })
 * );
 * ```
 */
export default handlerDefinitions;
