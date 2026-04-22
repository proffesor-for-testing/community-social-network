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

// API returns post shape with { id, authorId, content, status, reactionCounts, ... }.
// Map it to FE's richer PublicationDto shape. Author info not yet joined; placeholder.
type ApiPostResponse = {
  id: string;
  authorId: string;
  content: string;
  status: string;
  reactionCounts?: Record<string, number>;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
};

function adaptPost(p: ApiPostResponse): PublicationDto {
  const reactionCount = p.reactionCounts
    ? Object.values(p.reactionCounts).reduce((a, b) => a + b, 0)
    : 0;
  return {
    id: p.id,
    authorId: p.authorId,
    authorName: 'Member',
    authorAvatarUrl: null,
    title: null,
    body: p.content,
    type: 'post',
    status: (p.status?.toLowerCase() ?? 'published') as PublicationDto['status'],
    tags: [],
    reactionCount,
    commentCount: p.commentCount ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function fetchFeed(cursor?: string): Promise<FeedPage> {
  const params: Record<string, string> = { limit: '20' };
  if (cursor) {
    params.cursor = cursor;
  }
  const { data } = await apiClient.get<{
    items: ApiPostResponse[];
    nextCursor: string | null;
  }>('/publications/feed', { params });
  return {
    items: data.items.map(adaptPost),
    nextCursor: data.nextCursor,
  };
}

export async function fetchPublication(id: string): Promise<PublicationDto> {
  const { data } = await apiClient.get<ApiPostResponse>(`/publications/${id}`);
  return adaptPost(data);
}

export async function createPublication(dto: CreatePublicationDto): Promise<PublicationDto> {
  const { data } = await apiClient.post<{ id: string }>('/publications', {
    content: dto.body,
    visibility: 'PUBLIC',
  });
  // The create endpoint only returns { id } — fetch the full publication for the FE shape.
  return fetchPublication(data.id);
}

export async function deletePublication(id: string): Promise<void> {
  await apiClient.delete(`/publications/${id}`);
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export interface ReactionDto {
  publicationId: string;
  type: ReactionType;
}

const API_REACTION_TYPE: Record<ReactionType, string> = {
  like: 'LIKE',
  love: 'LOVE',
  laugh: 'HAHA',
  wow: 'WOW',
  sad: 'SAD',
  angry: 'ANGRY',
};

export async function addReaction(publicationId: string, type: ReactionType): Promise<void> {
  await apiClient.post(`/publications/${publicationId}/reactions`, {
    reactionType: API_REACTION_TYPE[type],
  });
}

export async function removeReaction(publicationId: string, type: ReactionType = 'like'): Promise<void> {
  await apiClient.delete(`/publications/${publicationId}/reactions`, {
    data: { reactionType: API_REACTION_TYPE[type] },
  });
}
