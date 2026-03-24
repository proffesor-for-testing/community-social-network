import { useQuery } from '@tanstack/react-query';
import { socialKeys, fetchFollowing } from '../queries';
import type { PaginatedResponse, ProfileDto } from '../../../api/types';

export function useFollowing(memberId: string, page = 1) {
  return useQuery<PaginatedResponse<ProfileDto>>({
    queryKey: socialKeys.following(memberId, page),
    queryFn: () => fetchFollowing(memberId, page),
    enabled: !!memberId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
