import React, { useState } from 'react';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { SearchBar } from '../../../shared/components/molecules/SearchBar';
import { useAdminUsers, useSuspendUser } from '../hooks/useUserManagement';

export function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isError } = useAdminUsers(page, searchQuery || undefined);
  const suspendMutation = useSuspendUser();

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const roleBadgeVariant: Record<string, 'default' | 'info' | 'warning'> = {
    member: 'default',
    moderator: 'info',
    admin: 'warning',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          User Management
        </h1>
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        onSubmit={handleSearch}
        placeholder="Search users by name or email..."
        className="max-w-md"
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load users.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="space-y-3">
            {data.items.length === 0 ? (
              <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                No users found.
              </p>
            ) : (
              data.items.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <Avatar alt={user.displayName} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        @{user.username} &middot; {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={roleBadgeVariant[user.role] ?? 'default'}
                      size="sm"
                    >
                      {user.role}
                    </Badge>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        suspendMutation.mutate({ userId: user.id })
                      }
                      loading={suspendMutation.isPending}
                    >
                      Suspend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        suspendMutation.mutate({ userId: user.id, unsuspend: true })
                      }
                      loading={suspendMutation.isPending}
                    >
                      Unsuspend
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
