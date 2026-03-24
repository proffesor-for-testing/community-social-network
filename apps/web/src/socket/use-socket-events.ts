import { useEffect } from 'react';
import { useSocket } from './socket-provider';

/**
 * Subscribe to a Socket.IO event for the lifetime of the calling component.
 *
 * @param event  - The event name to listen for.
 * @param handler - Callback invoked with the event payload.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
    // Intentionally depending on socket reference and event name only.
    // The handler is expected to be stable (wrap in useCallback at call site).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event]);
}

/**
 * Subscribe to multiple Socket.IO events at once.
 */
export function useSocketEvents(
  handlers: Record<string, (data: unknown) => void>,
): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const entries = Object.entries(handlers);
    for (const [event, handler] of entries) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of entries) {
        socket.off(event, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
}
