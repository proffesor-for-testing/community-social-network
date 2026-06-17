import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/query-config';
import { SocketProvider } from './socket/socket-provider';
import { ErrorBoundary } from './shared/error-boundary';
import { ToastContainer } from './shared/components/molecules/Toast';
import { SocketQueryInvalidator } from './socket/SocketQueryInvalidator';
import { router } from './router';
import { useBootstrapAuth } from './features/auth/hooks/useBootstrapAuth';

function AuthenticatedRouter() {
  const { isReady } = useBootstrapAuth();
  if (!isReady) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="auth-bootstrap-loading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--color-text-muted, #6b7280)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading…
      </div>
    );
  }
  return <RouterProvider router={router} />;
}

/**
 * Root application component.
 *
 * Provider order (outermost first):
 *   ErrorBoundary -> QueryClient -> Socket -> AuthBootstrap+Router -> Toast
 *
 * The router renders only after the silent refresh settles so guarded routes
 * don't bounce the user to /login during a page reload while the httpOnly
 * refresh cookie is being exchanged for an access token.
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <SocketQueryInvalidator />
          <AuthenticatedRouter />
          <ToastContainer />
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
