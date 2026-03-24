import React, { useState } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showFallback = !src || imgError;

  return (
    <div
      className={[
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={alt}
    >
      {showFallback ? (
        <span className="select-none font-medium" aria-hidden="true">
          {getInitials(alt)}
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
