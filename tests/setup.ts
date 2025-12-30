/**
 * Jest Test Setup
 * Configures mocks and test utilities for the Community Social Network
 */

// Using Jest global - no import needed
// TypeScript declarations for extended matchers are at the bottom

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.JWT_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2Z3qX2BTLS4e0ek55tEJQqHCEkT8TIfqkfXqX0qOPhZO7c4S
0qZzNQWvQeGmPGTdLaEGvMnfZRDXxZzCqzT0Cj8dLm8NYILIlAIYKe3S1p4mA0qa
VTW+6lKnvdGXWJYhwJ8KbPPVnC7g8CIKGW2NOHHdMxbCnLkJf1L8wOAAVJQD+1J0
3VIb0DRi0/sFV0c4Z4k9TAeyMyQ0x5wVKT2N+UhJpVjmVl9EJPPCwhlrq2885BWX
lBCbgJQvVCNPPwBUMy3ndUfr0DG2PIHZ/eA3lEZOhYSxKc4j3PoXJZ0CwmnnfI0M
mfbmPbBkQcMwjpBHJMx3WK0ky1F5J+vPIg4siwIDAQABAoIBAC7RzHX2jp0x8P6i
rhwKMy/X2v1Wg9X4CSlk+nFchK8TFPKlPSGq3B1nJjqCnGVpBCgJbfaRKq0vL5xQ
6nzHM0A4cz7wS4ytKE3v2b8SrMCgfYfk8BTFTY7aNeS/yAVaXmv2qNpCnihFcymQ
CkC2xnIwjQPkOMjx0ywj1GSXM3px3HJbO2tKiqdxSk27/R0XJHX3qQz7VX6WQpFG
jmWzS8KOlZbMX8UxgJ4e7VfpK3bMG7rVi0hRz4nRXwC6aRqXLQPfY1r0A3QFWN3C
kXx+yEgdJzjJkz7GMgCZ0rip+/7OwTjS0lQAUyDkyA0eaD/LsTE3VvxG1U8HGM3x
W5TqQaECgYEA8FaVpGmNLuwTlEtEhU5M5SbYjPvv0vmMPqLfKPQ0lWIlB2kkkg2m
7BQBpfUdFgOlZkND7wnFqJBYX7F8F0R2ay9AycEcqLF+qVZ0B4IjdMNwl9P/3Zj1
qAHjOF+XqhiY1D0bYnBvaM9U0gqMeT9PYl6sPL2ZdJvwSk9FUJjcI8sCgYEA5yM3
GWEPiF5PAAnoF7IN49ym+n0rX8FZaOoLVP1cIJjNxKl0p5OW3mq5M37kS3MtqjPe
9bJrSMnwB3mA3S3dKv2mVro6CYy5IYc2LT3YN8sCaJ+5p4w7pRT+FN5e0RNqNKXp
32XdTYVCwnfMlqecJPBgd3svRny96DwHAD7jQaECgYEAzj9n2K1cnH5v0OJ3tyfR
kCe6S5LFarXr0vFBEVHE0uDhUYhPZbnYTEBhCs6rGqKPNfXJABWpnwCj1gKtEn9w
0Q8x3TsvNALs0rT4ZJ4vEfXuOVXBa+PDw9jYhz8NtVABM2cMNf5u1fAyiQnCCcbB
oy/diVLVgBgSKmCkhwMDt9sCgYANm7R6ZI1YPNPlVv7wLP7HECHRgIRvTbk0gkCQ
lNK9Vw4f6v0hZpm4M/7H3DCBi3sk4dKiMbIK0sZvYe8VypT4XwfDgH6x8g9Y4N9P
qd2hqTSp0jRbFj1pwM8x4i6A4E2v8AUNz9P2OB6YlF4VRR+djW5y0dW5pdSBgqPO
q8OBAQKBgQCi4K2h8g0MgeP3f8PUM1s8Ec4R6Gs/qvmWHEF+5HlUK+T5K7lNS8Fx
VMONKvJA8xzL+aWr8vLpXQXJ7cTb6DnEF9k+FWTAPJ+f2w8L4ooAaqgB5Q6Xqlpo
K7or3Vgj7ACJwHnj4jL/mVp1pM2J0dpM5b1NDog+FOM49xNPQ3t3Qg==
-----END RSA PRIVATE KEY-----`;
process.env.JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Z3qX2BTLS4e0ek55tEJ
QqHCEkT8TIfqkfXqX0qOPhZO7c4S0qZzNQWvQeGmPGTdLaEGvMnfZRDXxZzCqzT0
Cj8dLm8NYILIlAIYKe3S1p4mA0qaVTW+6lKnvdGXWJYhwJ8KbPPVnC7g8CIKGW2N
OHHdMxbCnLkJf1L8wOAAVJQD+1J03VIb0DRi0/sFV0c4Z4k9TAeyMyQ0x5wVKT2N
+UhJpVjmVl9EJPPCwhlrq2885BWXlBCbgJQvVCNPPwBUMy3ndUfr0DG2PIHZ/eA3
lEZOhYSxKc4j3PoXJZ0CwmnnfI0MmfbmPbBkQcMwjpBHJMx3WK0ky1F5J+vPIg4s
iwIDAQAB
-----END PUBLIC KEY-----`;
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.BCRYPT_ROUNDS = '4'; // Lower rounds for faster tests
process.env.ACCESS_TOKEN_EXPIRY = '900'; // 15 minutes
process.env.REFRESH_TOKEN_EXPIRY = '604800'; // 7 days
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET = 'test-bucket';

// ============================================================================
// MOCK: REDIS CLIENT
// ============================================================================

const mockRedisStore = new Map<string, string>();

export const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
  set: jest.fn((key: string, value: string, _options?: { EX?: number }) => {
    mockRedisStore.set(key, value);
    return Promise.resolve('OK');
  }),
  setEx: jest.fn((key: string, _seconds: number, value: string) => {
    mockRedisStore.set(key, value);
    return Promise.resolve('OK');
  }),
  del: jest.fn((key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;
    keys.forEach(k => {
      if (mockRedisStore.has(k)) {
        mockRedisStore.delete(k);
        deleted++;
      }
    });
    return Promise.resolve(deleted);
  }),
  exists: jest.fn((key: string) => Promise.resolve(mockRedisStore.has(key) ? 1 : 0)),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  keys: jest.fn((pattern: string) => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const matchingKeys = Array.from(mockRedisStore.keys()).filter(k => regex.test(k));
    return Promise.resolve(matchingKeys);
  }),
  hSet: jest.fn().mockResolvedValue(1),
  hGet: jest.fn().mockResolvedValue(null),
  hGetAll: jest.fn().mockResolvedValue({}),
  hDel: jest.fn().mockResolvedValue(1),
  incr: jest.fn((key: string) => {
    const current = parseInt(mockRedisStore.get(key) || '0', 10);
    const newValue = (current + 1).toString();
    mockRedisStore.set(key, newValue);
    return Promise.resolve(current + 1);
  }),
  decr: jest.fn((key: string) => {
    const current = parseInt(mockRedisStore.get(key) || '0', 10);
    const newValue = (current - 1).toString();
    mockRedisStore.set(key, newValue);
    return Promise.resolve(current - 1);
  }),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  isOpen: true,
  isReady: true,
};

// Helper to clear Redis mock store between tests
export const clearMockRedis = () => {
  mockRedisStore.clear();
};

// ============================================================================
// MOCK: PRISMA CLIENT
// ============================================================================

export const mockPrismaClient: Record<string, unknown> = {
  $connect: jest.fn().mockResolvedValue(undefined as void),
  $disconnect: jest.fn().mockResolvedValue(undefined as void),
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  $queryRaw: jest.fn().mockResolvedValue([] as unknown[]),
  $executeRaw: jest.fn().mockResolvedValue(0 as number),

  user: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },

  userProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },

  post: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  postReaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },

  comment: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  commentReaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },

  group: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  groupMember: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  follow: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  block: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },

  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },

  auditLog: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// Helper to reset all Prisma mocks
export const resetPrismaMocks = () => {
  Object.values(mockPrismaClient).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(method => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
        }
      });
    }
  });
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Generate a mock user object for testing
 */
export const createMockUser = (overrides: Partial<{
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
  isVerified: boolean;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: 'test-user-id-' + Math.random().toString(36).substr(2, 9),
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: '$2b$04$test-hash',
  isActive: true,
  isVerified: true,
  role: 'USER' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  deletedAt: null,
  ...overrides,
});

/**
 * Generate a mock post object for testing
 */
export const createMockPost = (overrides: Partial<{
  id: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'GROUP' | 'PRIVATE';
  groupId: string | null;
  parentPostId: string | null;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: 'test-post-id-' + Math.random().toString(36).substr(2, 9),
  authorId: 'test-author-id',
  content: 'Test post content',
  mediaUrls: [],
  visibility: 'PUBLIC' as const,
  groupId: null,
  parentPostId: null,
  reactionCount: 0,
  commentCount: 0,
  shareCount: 0,
  isEdited: false,
  isPinned: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

/**
 * Generate a mock comment object for testing
 */
export const createMockComment = (overrides: Partial<{
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  reactionCount: number;
  replyCount: number;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: 'test-comment-id-' + Math.random().toString(36).substr(2, 9),
  postId: 'test-post-id',
  authorId: 'test-author-id',
  parentCommentId: null,
  content: 'Test comment content',
  reactionCount: 0,
  replyCount: 0,
  isEdited: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

/**
 * Generate a mock group object for testing
 */
export const createMockGroup = (overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  ownerId: string;
  privacy: 'PUBLIC' | 'PRIVATE' | 'SECRET';
  memberCount: number;
  postCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: 'test-group-id-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Group',
  slug: 'test-group',
  description: 'A test group for testing',
  coverUrl: null,
  avatarUrl: null,
  ownerId: 'test-owner-id',
  privacy: 'PUBLIC' as const,
  memberCount: 1,
  postCount: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

/**
 * Generate JWT token payload for testing
 */
export const createMockTokenPayload = (overrides: Partial<{
  userId: string;
  email: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  iat: number;
  exp: number;
}> = {}) => ({
  userId: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  role: 'USER' as const,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

/**
 * Wait for a specified number of milliseconds
 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a mock Express request object
 */
export const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  ip: '127.0.0.1',
  get: jest.fn((header: string) => (overrides.headers as Record<string, string>)?.[header]),
  ...overrides,
});

/**
 * Create a mock Express response object
 */
export const createMockResponse = () => {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create a mock Express next function
 */
export const createMockNext = () => jest.fn();

// ============================================================================
// GLOBAL SETUP & TEARDOWN
// ============================================================================

beforeAll(() => {
  // Silence console during tests unless explicitly needed
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep console.error for debugging test failures
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  clearMockRedis();
  resetPrismaMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});

afterAll(() => {
  // Restore console
  jest.restoreAllMocks();
});

// Increase timeout for async operations
jest.setTimeout(30000);

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// ============================================================================
// EXPORTS (No need to re-export jest - it's a global)
// ============================================================================
