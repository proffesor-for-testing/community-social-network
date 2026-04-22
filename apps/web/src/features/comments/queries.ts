import type { DiscussionDto, CreateDiscussionDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const commentKeys = {
  all: ['comments'] as const,
  forPost: (publicationId: string) =>
    [...commentKeys.all, 'post', publicationId] as const,
};

// ── API Functions ───────────────────────────────────────────────

export async function fetchComments(publicationId: string): Promise<DiscussionDto[]> {
  const { data } = await apiClient.get<DiscussionDto[]>(
    `/publications/${publicationId}/discussions`,
  );
  return data;
}

export async function createComment(dto: CreateDiscussionDto): Promise<DiscussionDto> {
  const { data } = await apiClient.post<DiscussionDto>(
    `/publications/${dto.publicationId}/discussions`,
    { content: dto.body, parentCommentId: dto.parentId },
  );
  return data;
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

export async function removeCommentReaction(
  commentId: string,
  type: string = 'like',
): Promise<void> {
  await apiClient.delete(`/discussions/${commentId}/reactions`, {
    data: { reactionType: COMMENT_REACTION_TYPE[type] ?? type.toUpperCase() },
  });
}
