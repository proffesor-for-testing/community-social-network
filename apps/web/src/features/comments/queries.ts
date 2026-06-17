import type { DiscussionDto, CreateDiscussionDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const commentKeys = {
  all: ['comments'] as const,
  forPost: (publicationId: string) =>
    [...commentKeys.all, 'post', publicationId] as const,
};

// ── API Functions ───────────────────────────────────────────────

// API returns { id, postId, authorId, content, parentId, depth, status, createdAt }.
// Map to FE's richer DiscussionDto shape.
type ApiCommentResponse = {
  id: string;
  postId?: string;
  publicationId?: string;
  authorId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  content: string;
  parentId: string | null;
  depth?: number;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

export function adaptComment(c: ApiCommentResponse): DiscussionDto {
  return {
    id: c.id,
    publicationId: c.publicationId ?? c.postId ?? '',
    authorId: c.authorId,
    authorName: c.authorName?.trim() ? c.authorName : 'Member',
    authorAvatarUrl: c.authorAvatarUrl ?? null,
    body: c.content,
    parentId: c.parentId,
    reactionCount: 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
  };
}

export async function fetchComments(publicationId: string): Promise<DiscussionDto[]> {
  const { data } = await apiClient.get<ApiCommentResponse[]>(
    `/publications/${publicationId}/discussions`,
  );
  return data.map(adaptComment);
}

export async function createComment(dto: CreateDiscussionDto): Promise<DiscussionDto> {
  const { data } = await apiClient.post<ApiCommentResponse>(
    `/publications/${dto.publicationId}/discussions`,
    { content: dto.body, parentCommentId: dto.parentId },
  );
  return adaptComment({ ...data, publicationId: dto.publicationId });
}

const COMMENT_REACTION_TYPE: Record<string, string> = {
  like: 'LIKE',
  love: 'LOVE',
  laugh: 'HAHA',
  wow: 'WOW',
  sad: 'SAD',
  angry: 'ANGRY',
};

export async function addCommentReaction(
  commentId: string,
  type: string,
): Promise<void> {
  await apiClient.post(`/discussions/${commentId}/reactions`, {
    reactionType: COMMENT_REACTION_TYPE[type] ?? type.toUpperCase(),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/discussions/${commentId}`);
}

export async function updateComment(
  commentId: string,
  content: string,
): Promise<void> {
  await apiClient.patch(`/discussions/${commentId}`, { content });
}

export async function removeCommentReaction(
  commentId: string,
  type: string = 'like',
): Promise<void> {
  await apiClient.delete(`/discussions/${commentId}/reactions`, {
    data: { reactionType: COMMENT_REACTION_TYPE[type] ?? type.toUpperCase() },
  });
}
