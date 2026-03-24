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
    { body: dto.body, parentId: dto.parentId },
  );
  return data;
}

export async function addCommentReaction(
  commentId: string,
  type: string,
): Promise<void> {
  await apiClient.post(`/discussions/${commentId}/reactions`, { type });
}

export async function removeCommentReaction(commentId: string): Promise<void> {
  await apiClient.delete(`/discussions/${commentId}/reactions`);
}
