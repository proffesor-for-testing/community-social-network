import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../shared/components/atoms/Button';
import { useFollow } from '../hooks/useFollow';
import { socialKeys, fetchConnectionStatus } from '../queries';
import type { ConnectionDto } from '../../../api/types';

interface FollowButtonProps {
  memberId: string;
  className?: string;
}

export function FollowButton({ memberId, className = '' }: FollowButtonProps) {
  const { data: status, isLoading: statusLoading } = useQuery<ConnectionDto | null>({
    queryKey: socialKeys.connectionStatus(memberId),
    queryFn: () => fetchConnectionStatus(memberId),
    staleTime: 30 * 1000,
  });

  const followMutation = useFollow();

  const isFollowing = status?.status === 'accepted';
  const isPending = status?.status === 'pending';

  const handleClick = () => {
    if (isFollowing || isPending) {
      followMutation.mutate({ memberId, unfollow: true });
    } else {
      followMutation.mutate({ memberId });
    }
  };

  const label = isFollowing ? 'Following' : isPending ? 'Pending' : 'Follow';
  const variant = isFollowing ? 'secondary' : isPending ? 'ghost' : 'primary';

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      loading={followMutation.isPending || statusLoading}
      className={className}
    >
      {label}
    </Button>
  );
}
