import type {
  AuditEntryDto,
  PaginatedResponse,
  CurrentUserDto,
} from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  auditLog: (page?: number, action?: string) =>
    [...adminKeys.all, 'audit', page, action] as const,
  users: (page?: number, search?: string) =>
    [...adminKeys.all, 'users', page, search] as const,
  securityAlerts: () => [...adminKeys.all, 'security-alerts'] as const,
};

// ── Type Definitions ────────────────────────────────────────────

export interface AdminStatsDto {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalGroups: number;
  totalReactions: number;
  newUsersToday: number;
  newPostsToday: number;
}

export interface SecurityAlertDto {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── API Functions ───────────────────────────────────────────────

export async function fetchAdminStats(): Promise<AdminStatsDto> {
  const { data } = await apiClient.get<AdminStatsDto>('/admin/stats');
  return data;
}

export async function fetchAuditLog(
  page = 1,
  limit = 20,
  action?: string,
): Promise<PaginatedResponse<AuditEntryDto>> {
  const params: Record<string, string | number> = { page, limit };
  if (action) params.action = action;
  const { data } = await apiClient.get<PaginatedResponse<AuditEntryDto>>(
    '/admin/audit-log',
    { params },
  );
  return data;
}

export async function fetchAdminUsers(
  page = 1,
  limit = 20,
  search?: string,
): Promise<PaginatedResponse<CurrentUserDto>> {
  const params: Record<string, string | number> = { page, limit };
  if (search) params.search = search;
  const { data } = await apiClient.get<PaginatedResponse<CurrentUserDto>>(
    '/admin/users',
    { params },
  );
  return data;
}

export async function suspendUser(userId: string): Promise<void> {
  await apiClient.patch(`/admin/users/${userId}/suspend`);
}

export async function unsuspendUser(userId: string): Promise<void> {
  await apiClient.patch(`/admin/users/${userId}/unsuspend`);
}

export async function fetchSecurityAlerts(): Promise<SecurityAlertDto[]> {
  const { data } = await apiClient.get<SecurityAlertDto[]>('/admin/security-alerts');
  return data;
}

export async function enable2FA(): Promise<{ qrCodeUrl: string; secret: string }> {
  const { data } = await apiClient.post<{ qrCodeUrl: string; secret: string }>(
    '/auth/2fa/enable',
  );
  return data;
}

export async function verify2FA(code: string): Promise<void> {
  await apiClient.post('/auth/2fa/verify', { code });
}
