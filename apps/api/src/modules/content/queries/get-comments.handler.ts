import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import {
  PublicationId,
  Discussion,
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { GetCommentsQuery } from './get-comments.query';
import { CommentResponseDto } from '../dto/comment-response.dto';

@QueryHandler(GetCommentsQuery)
export class GetCommentsHandler implements IQueryHandler<GetCommentsQuery, CommentResponseDto[]> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetCommentsQuery): Promise<CommentResponseDto[]> {
    const postId = PublicationId.create(query.postId);

    const exists = await this.publicationRepository.exists(postId);
    if (!exists) {
      throw new NotFoundException(`Post ${query.postId} not found`);
    }

    const discussions = await this.discussionRepository.findByPublicationId(postId);
    const active = discussions.filter((d) => d.status.isActive());

    const depthMap = this.calculateDepths(discussions);

    // Batch-fetch profiles for unique authors (no N+1).
    const uniqueAuthorIds = Array.from(
      new Set(active.map((d) => d.authorId.value)),
    ).map((id) => UserId.create(id));
    const profileByMemberId =
      uniqueAuthorIds.length > 0
        ? await this.profileRepository.findByMemberIds(uniqueAuthorIds)
        : new Map();

    return active.map((d) => {
      const profile = profileByMemberId.get(d.authorId.value);
      const author = profile
        ? { displayName: profile.displayName.value, avatarUrl: null }
        : undefined;
      return CommentResponseDto.fromDomain(d, depthMap.get(d.id.value) ?? 0, author);
    });
  }

  private calculateDepths(discussions: Discussion[]): Map<string, number> {
    const depthMap = new Map<string, number>();
    const discussionMap = new Map<string, Discussion>();

    for (const d of discussions) {
      discussionMap.set(d.id.value, d);
    }

    const getDepth = (id: string): number => {
      if (depthMap.has(id)) {
        return depthMap.get(id)!;
      }

      const discussion = discussionMap.get(id);
      if (!discussion || !discussion.parentId) {
        depthMap.set(id, 0);
        return 0;
      }

      const parentDepth = getDepth(discussion.parentId.value);
      const depth = parentDepth + 1;
      depthMap.set(id, depth);
      return depth;
    };

    for (const d of discussions) {
      getDepth(d.id.value);
    }

    return depthMap;
  }
}
