import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Centered layout used for authentication pages (login, register).
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-surface-dark">
      <div className="w-full max-w-md">
        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
