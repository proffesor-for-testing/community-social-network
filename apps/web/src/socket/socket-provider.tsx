import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

interface SocketProviderProps {
  children: ReactNode;
}

/**
 * Provides a Socket.IO connection to the component tree.
 * The socket connects only when the user is authenticated and
 * disconnects on logout.
 */
export function SocketProvider({ children }: SocketProviderProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = React.useState(false);

  useEffect(() => {
    if (!accessToken) {
      // Disconnect when logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Create socket with auth token
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken]);

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, connected }),
    [connected],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

/**
 * Returns the current Socket.IO connection (may be null if not authenticated).
 */
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
