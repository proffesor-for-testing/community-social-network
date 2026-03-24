import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/components/atoms/Badge';
import type { GroupDto } from '../../../api/types';

interface GroupCardProps {
  group: GroupDto;
  className?: string;
}

const visibilityVariant: Record<string, 'default' | 'info' | 'warning'> = {
  public: 'info',
  private: 'warning',
  secret: 'danger' as 'warning', // using warning for secret since danger fits
};

export function GroupCard({ group, className = '' }: GroupCardProps) {
  return (
    <Link
      to={`/communities/${group.id}`}
      className={[
        'card block transition-shadow hover:shadow-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {group.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {group.description}
          </p>
        </div>
        <Badge variant={visibilityVariant[group.visibility] ?? 'default'} size="sm" className="ml-2 shrink-0">
          {group.visibility}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
