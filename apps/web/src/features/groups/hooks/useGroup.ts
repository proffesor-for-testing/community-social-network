import { useQuery } from '@tanstack/react-query';
import { groupKeys, fetchGroup } from '../queries';
import type { GroupDto } from '../../../api/types';

export function useGroup(groupId: string) {
  return useQuery<GroupDto>({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => fetchGroup(groupId),
    enabled: !!groupId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
