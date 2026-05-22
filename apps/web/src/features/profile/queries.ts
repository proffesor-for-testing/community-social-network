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
  const { data } = await apiClient.get<ProfileDto>(`/profiles/member/${memberId}`);
  return data;
}

export async function fetchMyProfile(): Promise<ProfileDto> {
  const { data } = await apiClient.get<ProfileDto>('/profiles/me');
  return data;
}

export async function updateProfile(dto: UpdateProfileDto): Promise<ProfileDto> {
  // API expects city/country separately and rejects unknown fields (website).
  const payload: Record<string, string | undefined> = {};
  if (dto.displayName !== undefined) payload.displayName = dto.displayName;
  if (dto.bio !== undefined) payload.bio = dto.bio;
  if (dto.location !== undefined) {
    const [city, ...rest] = dto.location.split(',').map((s) => s.trim());
    if (city) payload.city = city;
    if (rest.length > 0 && rest.join(', ')) payload.country = rest.join(', ');
  }
  const { data } = await apiClient.patch<ProfileDto>('/profiles/me', payload);
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
