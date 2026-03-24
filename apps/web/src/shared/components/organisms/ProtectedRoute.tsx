import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';
import { Spinner } from '../atoms/Spinner';
import { useCurrentUser } from '../../../features/auth/hooks/useCurrentUser';

/**
 * Route guard that redirects unauthenticated users to /login.
 * While the current-user query is in flight, a loading spinner is shown.
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const { isLoading } = useCurrentUser();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <Outlet />;
}
