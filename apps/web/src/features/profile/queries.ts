import type { ProfileDto, UpdateProfileDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (memberId: string) => [...profileKeys.all, memberId] as const,
  me: () => [...profileKeys.all, 'me'] as const,
};

// ── API Functions ───────────────────────────────────────────────

export async function fetchProfile(memberId: string): Promise<ProfileDto> {
  const { data } = await apiClient.get<ProfileDto>(`/profiles/${memberId}`);
  return data;
}

export async function fetchMyProfile(): Promise<ProfileDto> {
  const { data } = await apiClient.get<ProfileDto>('/profiles/me');
  return data;
}

export async function updateProfile(dto: UpdateProfileDto): Promise<ProfileDto> {
  const { data } = await apiClient.patch<ProfileDto>('/profiles/me', dto);
  return data;
}

export async function uploadAvatar(file: File): Promise<ProfileDto> {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await apiClient.post<ProfileDto>('/profiles/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
