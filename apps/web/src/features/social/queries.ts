import type {
  ConnectionDto,
  PaginatedResponse,
  ProfileDto,
  SendConnectionRequestDto,
} from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const socialKeys = {
  all: ['social'] as const,
  followers: (memberId: string, page?: number) =>
    [...socialKeys.all, 'followers', memberId, page] as const,
  following: (memberId: string, page?: number) =>
    [...socialKeys.all, 'following', memberId, page] as const,
  blocked: () => [...socialKeys.all, 'blocked'] as const,
  pending: () => [...socialKeys.all, 'pending'] as const,
  connectionStatus: (memberId: string) =>
    [...socialKeys.all, 'status', memberId] as const,
};

// ── API Functions ───────────────────────────────────────────────

function normalizePaginated<T>(
  data: PaginatedResponse<T> | { items: T[]; total?: number; cursor?: unknown } | T[],
  page: number,
  limit: number,
): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page, pageSize: limit, totalPages: 1 };
  }
  return {
    items: data.items ?? [],
    total: (data as PaginatedResponse<T>).total ?? data.items?.length ?? 0,
    page: (data as PaginatedResponse<T>).page ?? page,
    pageSize: (data as PaginatedResponse<T>).pageSize ?? limit,
    totalPages: (data as PaginatedResponse<T>).totalPages ?? 1,
  };
}

export async function fetchFollowers(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<
    PaginatedResponse<ProfileDto> | { items: ProfileDto[] } | ProfileDto[]
  >(`/connections/${memberId}/followers`, { params: { page, limit } });
  return normalizePaginated(data, page, limit);
}

export async function fetchFollowing(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<
    PaginatedResponse<ProfileDto> | { items: ProfileDto[] } | ProfileDto[]
  >(`/connections/${memberId}/following`, { params: { page, limit } });
  return normalizePaginated(data, page, limit);
}

export async function fetchBlocked(): Promise<ProfileDto[]> {
  const { data } = await apiClient.get<
    ProfileDto[] | { items: ProfileDto[] }
  >('/connections/blocked');
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function fetchPendingRequests(): Promise<ConnectionDto[]> {
  const { data } = await apiClient.get<
    ConnectionDto[] | { items: ConnectionDto[] }
  >('/connections/pending');
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function fetchConnectionStatus(
  memberId: string,
): Promise<ConnectionDto | null> {
  try {
    const { data } = await apiClient.get<ConnectionDto>(
      `/connections/status/${memberId}`,
    );
    return data;
  } catch {
    return null;
  }
}

export async function sendFollowRequest(dto: SendConnectionRequestDto): Promise<ConnectionDto> {
  const { data } = await apiClient.post<ConnectionDto>('/connections', dto);
  return data;
}

export async function unfollowUser(memberId: string): Promise<void> {
  await apiClient.delete(`/connections/${memberId}`);
}

export async function acceptRequest(connectionId: string): Promise<ConnectionDto> {
  const { data } = await apiClient.patch<ConnectionDto>(
    `/connections/${connectionId}/accept`,
  );
  return data;
}

export async function declineRequest(connectionId: string): Promise<void> {
  await apiClient.patch(`/connections/${connectionId}/decline`);
}

export async function blockUser(memberId: string): Promise<void> {
  await apiClient.post(`/connections/block/${memberId}`);
}

export async function unblockUser(memberId: string): Promise<void> {
  await apiClient.delete(`/connections/block/${memberId}`);
}
