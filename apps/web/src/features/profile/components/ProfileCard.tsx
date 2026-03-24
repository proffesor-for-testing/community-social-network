import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Badge } from '../../../shared/components/atoms/Badge';
import type { ProfileDto } from '../../../api/types';

interface ProfileCardProps {
  profile: ProfileDto;
  className?: string;
}

export function ProfileCard({ profile, className = '' }: ProfileCardProps) {
  return (
    <div
      className={[
        'card flex items-center gap-4 transition-shadow hover:shadow-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Link to={`/profile/${profile.memberId}`} className="shrink-0">
        <Avatar src={profile.avatarUrl} alt={profile.displayName} size="lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/profile/${profile.memberId}`}
          className="text-base font-semibold text-gray-900 hover:underline dark:text-gray-100"
        >
          {profile.displayName}
        </Link>
        {profile.bio && (
          <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
            {profile.bio}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {profile.location && (
            <Badge variant="default" size="sm">
              {profile.location}
            </Badge>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              Website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
