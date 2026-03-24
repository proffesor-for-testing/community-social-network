import { useQuery } from '@tanstack/react-query';
import { adminKeys, fetchAdminStats, type AdminStatsDto } from '../queries';

export function useAdminStats() {
  return useQuery<AdminStatsDto>({
    queryKey: adminKeys.stats(),
    queryFn: fetchAdminStats,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
