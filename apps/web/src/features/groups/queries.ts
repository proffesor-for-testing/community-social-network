import type {
  GroupDto,
  CreateGroupDto,
  MembershipDto,
  PaginatedResponse,
} from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const groupKeys = {
  all: ['groups'] as const,
  list: (page?: number) => [...groupKeys.all, 'list', page] as const,
  detail: (groupId: string) => [...groupKeys.all, groupId] as const,
  members: (groupId: string, page?: number) =>
    [...groupKeys.all, groupId, 'members', page] as const,
  myGroups: () => [...groupKeys.all, 'mine'] as const,
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

export async function createGroup(dto: CreateGroupDto): Promise<GroupDto> {
  const { data } = await apiClient.post<GroupDto>('/groups', dto);
  return data;
}

export async function updateGroup(
  groupId: string,
  dto: Partial<CreateGroupDto>,
): Promise<GroupDto> {
  const { data } = await apiClient.patch<GroupDto>(`/groups/${groupId}`, dto);
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
