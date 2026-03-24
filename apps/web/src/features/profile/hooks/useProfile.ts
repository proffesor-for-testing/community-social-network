import { useQuery } from '@tanstack/react-query';
import { profileKeys, fetchProfile, fetchMyProfile } from '../queries';
import type { ProfileDto } from '../../../api/types';

/**
 * Fetch a profile by member ID.
 * If no memberId is provided, fetches the current user's profile.
 */
export function useProfile(memberId?: string) {
  return useQuery<ProfileDto>({
    queryKey: memberId ? profileKeys.detail(memberId) : profileKeys.me(),
    queryFn: () => (memberId ? fetchProfile(memberId) : fetchMyProfile()),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
