import type {
  GroupDto,
  CreateGroupDto,
  MembershipDto,
  PaginatedResponse,
} from '../../api/types';
import { apiClient } from '../../api/client';
import { adaptPost, type FeedPage } from '../feed/queries';

// ── Query Key Factories ─────────────────────────────────────────

export const groupKeys = {
  all: ['groups'] as const,
  list: (page?: number) => [...groupKeys.all, 'list', page] as const,
  detail: (groupId: string) => [...groupKeys.all, groupId] as const,
  members: (groupId: string, page?: number) =>
    [...groupKeys.all, groupId, 'members', page] as const,
  myGroups: () => [...groupKeys.all, 'mine'] as const,
  posts: (groupId: string) => [...groupKeys.all, groupId, 'posts'] as const,
};

// ── API Functions ───────────────────────────────────────────────

export async function fetchGroups(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<GroupDto>> {
  const { data } = await apiClient.get<PaginatedResponse<GroupDto>>('/groups', {
    params: { page, limit },
  });
  return data;
}

export async function fetchGroup(groupId: string): Promise<GroupDto> {
  const { data } = await apiClient.get<GroupDto>(`/groups/${groupId}`);
  return data;
}

function toApiGroupPayload(dto: Partial<CreateGroupDto>) {
  const { name, description, visibility } = dto;
  const payload: Record<string, unknown> = {};
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  if (visibility !== undefined) {
    payload.settings = {
      isPublic: visibility === 'public',
      requireApproval: visibility !== 'public',
    };
  }
  return payload;
}

export async function createGroup(dto: CreateGroupDto): Promise<GroupDto> {
  const { data } = await apiClient.post<GroupDto>('/groups', toApiGroupPayload(dto));
  return data;
}

export async function updateGroup(
  groupId: string,
  dto: Partial<CreateGroupDto>,
): Promise<GroupDto> {
  const { data } = await apiClient.patch<GroupDto>(`/groups/${groupId}`, toApiGroupPayload(dto));
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}`);
}

export async function fetchGroupMembers(
  groupId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<MembershipDto>> {
  const { data } = await apiClient.get<PaginatedResponse<MembershipDto>>(
    `/groups/${groupId}/members`,
    { params: { page, limit } },
  );
  return data;
}

export async function joinGroup(groupId: string): Promise<MembershipDto> {
  const { data } = await apiClient.post<MembershipDto>(
    `/groups/${groupId}/members`,
  );
  return data;
}

export async function leaveGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/members/me`);
}

export async function fetchMyGroups(): Promise<GroupDto[]> {
  const { data } = await apiClient.get<GroupDto[]>('/groups/mine');
  return data;
}

// ── Group posts ─────────────────────────────────────────────────

/** One page of a group's feed. Members only; the API rejects everyone else. */
export async function fetchGroupPublications(
  groupId: string,
  cursor?: string,
): Promise<FeedPage> {
  const params: Record<string, string> = { limit: '20' };
  if (cursor) {
    params.cursor = cursor;
  }
  const { data } = await apiClient.get<{
    items: Parameters<typeof adaptPost>[0][];
    nextCursor: string | null;
  }>(`/groups/${groupId}/publications`, { params });
  return {
    items: data.items.map(adaptPost),
    nextCursor: data.nextCursor,
  };
}

export async function createGroupPublication(
  groupId: string,
  content: string,
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    `/groups/${groupId}/publications`,
    { content },
  );
  return data;
}
