import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';

/**
 * Nested guard for /admin/*: only users whose /auth/me role is 'admin' may
 * enter. Non-admins are sent to the feed. Rendered inside ProtectedRoute, so
 * the current user has already been resolved by the time this mounts.
 */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
