import { useQuery } from '@tanstack/react-query';
import { groupKeys, fetchGroupMembers } from '../queries';
import type { PaginatedResponse, MembershipDto } from '../../../api/types';

export function useGroupMembers(groupId: string, page = 1) {
  return useQuery<PaginatedResponse<MembershipDto>>({
    queryKey: groupKeys.members(groupId, page),
    queryFn: () => fetchGroupMembers(groupId, page),
    enabled: !!groupId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
