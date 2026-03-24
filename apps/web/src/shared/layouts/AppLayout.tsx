import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/organisms/Header';
import { Sidebar } from '../components/organisms/Sidebar';
import { useUiStore } from '../../stores/ui.store';

/**
 * Main application layout: header at top, sidebar on left, content area.
 */
export function AppLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark">
      <Header />
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main
        className={[
          'min-h-[calc(100vh-4rem)] transition-all duration-200 pt-4 px-4 pb-8',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16',
        ].join(' ')}
      >
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
