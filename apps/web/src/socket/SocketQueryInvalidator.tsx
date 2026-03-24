import { useSocketQueryInvalidation } from './event-invalidation';

/**
 * Headless component that bridges Socket.IO events to TanStack Query
 * cache invalidation. Renders nothing; just activates the hook.
 */
export function SocketQueryInvalidator() {
  useSocketQueryInvalidation();
  return null;
}
