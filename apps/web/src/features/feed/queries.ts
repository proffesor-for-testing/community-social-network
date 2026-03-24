import type { PublicationDto, CreatePublicationDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const feedKeys = {
  all: ['feed'] as const,
  list: (cursor?: string) => [...feedKeys.all, 'list', cursor] as const,
  detail: (postId: string) => [...feedKeys.all, 'detail', postId] as const,
};

export const publicationKeys = {
  all: ['publications'] as const,
  detail: (id: string) => [...publicationKeys.all, id] as const,
};

// ── Cursor-based pagination response ────────────────────────────

export interface FeedPage {
  items: PublicationDto[];
  nextCursor: string | null;
}

// ── API Functions ───────────────────────────────────────────────

export async function fetchFeed(cursor?: string): Promise<FeedPage> {
  const params: Record<string, string> = { limit: '20' };
  if (cursor) {
    params.cursor = cursor;
  }
  const { data } = await apiClient.get<FeedPage>('/publications/feed', { params });
  return data;
}

export async function fetchPublication(id: string): Promise<PublicationDto> {
  const { data } = await apiClient.get<PublicationDto>(`/publications/${id}`);
  return data;
}

export async function createPublication(dto: CreatePublicationDto): Promise<PublicationDto> {
  const { data } = await apiClient.post<PublicationDto>('/publications', dto);
  return data;
}

export async function deletePublication(id: string): Promise<void> {
  await apiClient.delete(`/publications/${id}`);
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export interface ReactionDto {
  publicationId: string;
  type: ReactionType;
}

export async function addReaction(publicationId: string, type: ReactionType): Promise<void> {
  await apiClient.post(`/publications/${publicationId}/reactions`, { type });
}

export async function removeReaction(publicationId: string): Promise<void> {
  await apiClient.delete(`/publications/${publicationId}/reactions`);
}
