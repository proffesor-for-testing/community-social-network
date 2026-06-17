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
    return { items: data, total: data.length, page, limit, totalPages: 1 };
  }
  return {
    items: data.items ?? [],
    total: (data as PaginatedResponse<T>).total ?? data.items?.length ?? 0,
    page: (data as PaginatedResponse<T>).page ?? page,
    limit: (data as PaginatedResponse<T>).limit ?? limit,
    totalPages: (data as PaginatedResponse<T>).totalPages ?? 1,
  };
}

// Builds a ProfileDto for the "other side" of a connection from the
// perspective of `perspectiveMemberId`. When the perspective member is the
// followee, the other side is the follower (and vice-versa). The API now
// joins Profile data into each connection — read the matching name/avatar.
// Falls back to 'Member' if the API hasn't been redeployed yet.
export function connectionToProfile(
  c: ApiConnection,
  perspectiveMemberId: string,
): ProfileDto {
  const isFollower = (c.followeeId ?? c.addresseeId) === perspectiveMemberId;
  const otherId = isFollower
    ? (c.followerId ?? c.requesterId ?? '')
    : (c.followeeId ?? c.addresseeId ?? '');
  const otherName = isFollower
    ? (c.followerName ?? '')
    : (c.followeeName ?? '');
  const otherAvatar = isFollower
    ? (c.followerAvatarUrl ?? null)
    : (c.followeeAvatarUrl ?? null);
  return {
    id: c.id,
    memberId: otherId,
    displayName: otherName.trim() ? otherName : 'Member',
    bio: null,
    avatarUrl: otherAvatar,
    location: null,
    website: null,
    joinedAt: c.createdAt,
  };
}

export async function fetchFollowers(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<
    | PaginatedResponse<ApiConnection>
    | { items: ApiConnection[] }
    | ApiConnection[]
  >(`/connections/${memberId}/followers`, { params: { page, limit } });
  const items = Array.isArray(data) ? data : data.items ?? [];
  const profiles = items.map((c) => connectionToProfile(c, memberId));
  const total = Array.isArray(data) ? data.length : (data as PaginatedResponse<unknown>).total ?? profiles.length;
  const totalPages = Array.isArray(data) ? 1 : (data as PaginatedResponse<unknown>).totalPages ?? 1;
  return { items: profiles, total, page, limit, totalPages };
}

export async function fetchFollowing(
  memberId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<ProfileDto>> {
  const { data } = await apiClient.get<
    | PaginatedResponse<ApiConnection>
    | { items: ApiConnection[] }
    | ApiConnection[]
  >(`/connections/${memberId}/following`, { params: { page, limit } });
  const items = Array.isArray(data) ? data : data.items ?? [];
  const profiles = items.map((c) => connectionToProfile(c, memberId));
  const total = Array.isArray(data) ? data.length : (data as PaginatedResponse<unknown>).total ?? profiles.length;
  const totalPages = Array.isArray(data) ? 1 : (data as PaginatedResponse<unknown>).totalPages ?? 1;
  return { items: profiles, total, page, limit, totalPages };
}

export async function fetchBlocked(): Promise<ProfileDto[]> {
  const { data } = await apiClient.get<
    ProfileDto[] | { items: ProfileDto[] }
  >('/connections/blocked');
  return Array.isArray(data) ? data : data.items ?? [];
}

// API returns connections with { id, followerId, followeeId, status, createdAt }.
// Adapt to FE's ConnectionDto { id, requesterId, addresseeId, status, createdAt }.
type ApiConnection = {
  id: string;
  followerId?: string;
  followerName?: string;
  followerAvatarUrl?: string | null;
  followeeId?: string;
  followeeName?: string;
  followeeAvatarUrl?: string | null;
  requesterId?: string;
  addresseeId?: string;
  status: string;
  createdAt: string;
};

export function adaptConnection(c: ApiConnection): ConnectionDto {
  return {
    id: c.id,
    requesterId: c.requesterId ?? c.followerId ?? '',
    requesterName: c.followerName,
    requesterAvatarUrl: c.followerAvatarUrl ?? null,
    addresseeId: c.addresseeId ?? c.followeeId ?? '',
    addresseeName: c.followeeName,
    addresseeAvatarUrl: c.followeeAvatarUrl ?? null,
    status: (c.status ?? '').toLowerCase() as ConnectionDto['status'],
    createdAt: c.createdAt,
  };
}

export async function fetchPendingRequests(): Promise<ConnectionDto[]> {
  const { data } = await apiClient.get<
    ApiConnection[] | { items: ApiConnection[] }
  >('/connections/pending');
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map(adaptConnection);
}

export async function fetchConnectionStatus(
  memberId: string,
): Promise<ConnectionDto | null> {
  try {
    const { data } = await apiClient.get<ApiConnection>(
      `/connections/status/${memberId}`,
    );
    return adaptConnection(data);
  } catch {
    // 404 → no connection at all. The status endpoint now returns pending
    // requests in either direction, so a fallback isn't needed here.
    return null;
  }
}

export async function sendFollowRequest(dto: SendConnectionRequestDto): Promise<ConnectionDto> {
  const { data } = await apiClient.post<ConnectionDto>('/connections', {
    memberId: dto.addresseeId,
  });
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
