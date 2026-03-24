import React from 'react';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useAdminStats } from '../hooks/useAdminStats';

interface StatCardProps {
  label: string;
  value: number | string;
  change?: string;
}

function StatCard({ label, value, change }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change && (
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">{change}</p>
      )}
    </div>
  );
}

export function Dashboard() {
  const { data: stats, isLoading, isError } = useAdminStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load admin stats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Admin Dashboard
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          change={`+${stats.newUsersToday} today`}
        />
        <StatCard label="Active Users" value={stats.activeUsers} />
        <StatCard
          label="Total Posts"
          value={stats.totalPosts}
          change={`+${stats.newPostsToday} today`}
        />
        <StatCard label="Total Groups" value={stats.totalGroups} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Engagement
          </h2>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Reactions</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.totalReactions.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Posts per User</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.totalUsers > 0
                  ? (stats.totalPosts / stats.totalUsers).toFixed(1)
                  : '0'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Quick Actions
          </h2>
          <div className="mt-3 space-y-2">
            <a
              href="/admin/users"
              className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
            >
              Manage Users
            </a>
            <a
              href="/admin/audit"
              className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
            >
              View Audit Log
            </a>
            <a
              href="/admin/security"
              className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
            >
              Security Alerts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
