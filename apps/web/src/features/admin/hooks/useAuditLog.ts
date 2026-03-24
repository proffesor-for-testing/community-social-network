import { useQuery } from '@tanstack/react-query';
import { adminKeys, fetchAuditLog } from '../queries';
import type { PaginatedResponse, AuditEntryDto } from '../../../api/types';

export function useAuditLog(page = 1, action?: string) {
  return useQuery<PaginatedResponse<AuditEntryDto>>({
    queryKey: adminKeys.auditLog(page, action),
    queryFn: () => fetchAuditLog(page, 20, action),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
