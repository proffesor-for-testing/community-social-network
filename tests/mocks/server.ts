/**
 * MSW Server Setup
 *
 * Configures a Mock Service Worker server for use in Node.js test environments
 * (vitest, jest). The server intercepts all HTTP requests and routes them to
 * the handlers defined in ./handlers.ts.
 *
 * Usage in test files:
 *
 * ```ts
 * import { server } from '../mocks/server';
 *
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * Prerequisites: MSW v2 must be installed:
 *   npm install msw --save-dev
 *
 * If MSW is not installed, this module exports a no-op server stub
 * so that imports do not break compilation.
 */

import { handlerDefinitions } from './handlers';

// ── MSW Server Factory ──────────────────────────────────────────────────────

let _server: MswServer | null = null;

interface MswServer {
  listen(options?: { onUnhandledRequest?: 'error' | 'warn' | 'bypass' }): void;
  resetHandlers(): void;
  close(): void;
  use(...handlers: unknown[]): void;
}

/**
 * Create or return the cached MSW server instance.
 *
 * Attempts to dynamically import MSW. If it is not installed,
 * returns a no-op stub that logs a warning.
 */
async function createMswServer(): Promise<MswServer> {
  if (_server) return _server;

  try {
    // Dynamic import so the module does not fail if msw is not installed
    const { setupServer } = await import('msw/node');
    const { http, HttpResponse } = await import('msw');

    const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

    const handlers = handlerDefinitions.map((def) => {
      const method = def.method.toLowerCase() as keyof typeof http;
      const fullPath = `${BASE_URL}${def.path}`;

      return (http as Record<string, (...args: unknown[]) => unknown>)[method](
        fullPath,
        () => {
          const res = def.response();
          const body = res.body ? JSON.parse(res.body) : null;
          return HttpResponse.json(body, { status: res.status });
        },
      );
    });

    _server = setupServer(...handlers);
    return _server;
  } catch {
    // MSW not installed -- return stub
    console.warn(
      '[MSW] msw package not found. Install with: npm install msw --save-dev',
    );
    console.warn(
      '[MSW] Using no-op server stub. Frontend tests that depend on MSW will not intercept requests.',
    );

    _server = {
      listen() {
        /* no-op */
      },
      resetHandlers() {
        /* no-op */
      },
      close() {
        /* no-op */
      },
      use() {
        /* no-op */
      },
    };

    return _server;
  }
}

// ── Eager export for sync imports ───────────────────────────────────────────

/**
 * Synchronous server reference. Call `initServer()` in a `beforeAll` hook
 * to initialize it, then use this reference in `afterEach` and `afterAll`.
 *
 * ```ts
 * import { server, initServer } from '../mocks/server';
 *
 * beforeAll(async () => {
 *   await initServer();
 *   server.listen({ onUnhandledRequest: 'error' });
 * });
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export let server: MswServer = {
  listen() {
    console.warn('[MSW] Server not initialized. Call initServer() first.');
  },
  resetHandlers() {
    /* no-op */
  },
  close() {
    /* no-op */
  },
  use() {
    /* no-op */
  },
};

export async function initServer(): Promise<MswServer> {
  server = await createMswServer();
  return server;
}

// ── Default export ──────────────────────────────────────────────────────────

export default server;
