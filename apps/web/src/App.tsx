import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/query-config';
import { SocketProvider } from './socket/socket-provider';
import { ErrorBoundary } from './shared/error-boundary';
import { ToastContainer } from './shared/components/molecules/Toast';
import { SocketQueryInvalidator } from './socket/SocketQueryInvalidator';
import { router } from './router';

/**
 * Root application component.
 *
 * Provider order (outermost first):
 *   ErrorBoundary -> QueryClient -> Socket -> Router -> Toast overlay
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <SocketQueryInvalidator />
          <RouterProvider router={router} />
          <ToastContainer />
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
