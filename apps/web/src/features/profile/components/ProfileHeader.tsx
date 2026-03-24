import React from 'react';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useProfile } from '../hooks/useProfile';

interface ProfileHeaderProps {
  memberId?: string;
}

export function ProfileHeader({ memberId }: ProfileHeaderProps) {
  const { data: profile, isLoading, isError } = useProfile(memberId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load profile.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Cover area */}
      <div className="h-32 rounded-t-xl bg-gradient-to-r from-brand-500 to-brand-700 dark:from-brand-700 dark:to-brand-900" />

      {/* Profile info */}
      <div className="relative px-6 pb-6">
        <div className="-mt-12 flex items-end gap-4">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.displayName}
            size="xl"
            className="ring-4 ring-white dark:ring-surface-dark-secondary"
          />
          <div className="pb-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {profile.displayName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Joined {new Date(profile.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            {profile.bio}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {profile.location && (
            <Badge variant="default" size="sm">
              <svg
                className="mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              {profile.location}
            </Badge>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-4.06a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757"
                />
              </svg>
              {profile.website}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
