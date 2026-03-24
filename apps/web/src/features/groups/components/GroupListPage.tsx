import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../shared/components/atoms/Button';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { GroupCard } from './GroupCard';
import { groupKeys, fetchGroups } from '../queries';
import type { PaginatedResponse, GroupDto } from '../../../api/types';

export function GroupListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<PaginatedResponse<GroupDto>>({
    queryKey: groupKeys.list(page),
    queryFn: () => fetchGroups(page),
    staleTime: 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Communities
        </h1>
        <Link to="/communities/new">
          <Button size="sm">Create Group</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load communities.
          </p>
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-gray-500 dark:text-gray-400">
          No communities yet. Create the first one!
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
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
