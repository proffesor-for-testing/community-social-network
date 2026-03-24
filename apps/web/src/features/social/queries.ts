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

export async function fetchFollowers(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<PaginatedResponse<ProfileDto>>(
    `/connections/${memberId}/followers`,
    { params: { page, limit } },
  );
  return data;
}

export async function fetchFollowing(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<PaginatedResponse<ProfileDto>>(
    `/connections/${memberId}/following`,
    { params: { page, limit } },
  );
  return data;
}

export async function fetchBlocked(): Promise<ProfileDto[]> {
  const { data } = await apiClient.get<ProfileDto[]>('/connections/blocked');
  return data;
}

export async function fetchPendingRequests(): Promise<ConnectionDto[]> {
  const { data } = await apiClient.get<ConnectionDto[]>('/connections/pending');
  return data;
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
