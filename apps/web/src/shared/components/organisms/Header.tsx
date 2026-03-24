import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';
import { useUiStore } from '../../../stores/ui.store';
import { useNotificationStore } from '../../../stores/notification.store';
import { useLogout } from '../../../features/auth/hooks/useLogout';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleMobileMenu = useUiStore((s) => s.toggleMobileMenu);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { mutate: logout } = useLogout();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-surface-dark">
      {/* Sidebar toggle (desktop) */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary lg:inline-flex"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Logo */}
      <Link
        to="/"
        className="ml-2 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100"
      >
        <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-sm text-white">
          CSN
        </span>
        <span className="hidden sm:inline">Community</span>
      </Link>

      <div className="flex-1" />

      {/* Notifications */}
      <Link
        to="/notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>

      {/* User dropdown */}
      <div ref={menuRef} className="relative ml-2">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="User menu"
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-surface-dark-tertiary"
        >
          <Avatar
            src={null}
            alt={user?.displayName ?? 'User'}
            size="sm"
          />
          <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 md:inline">
            {user?.displayName}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 origin-top-right animate-fade-in rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-surface-dark-secondary"
          >
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.displayName}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>

            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
            >
              Your Profile
            </Link>
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
            >
              Settings
            </Link>

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
              >
                <div className="flex items-center gap-2">
                  Admin Dashboard
                  <Badge variant="warning" size="sm">Admin</Badge>
                </div>
              </Link>
            )}

            <div className="border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
