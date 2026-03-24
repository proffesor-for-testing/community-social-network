import { useQuery } from '@tanstack/react-query';
import { socialKeys, fetchFollowers } from '../queries';
import type { PaginatedResponse, ProfileDto } from '../../../api/types';

export function useFollowers(memberId: string, page = 1) {
  return useQuery<PaginatedResponse<ProfileDto>>({
    queryKey: socialKeys.followers(memberId, page),
    queryFn: () => fetchFollowers(memberId, page),
    enabled: !!memberId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
