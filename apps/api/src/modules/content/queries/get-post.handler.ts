import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, Optional } from '@nestjs/common';
import {
  PublicationId,
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { GetPostQuery } from './get-post.query';
import { PostResponseDto } from '../dto/post-response.dto';
import { ViewerReactionService } from '../services/viewer-reaction.service';

@QueryHandler(GetPostQuery)
export class GetPostHandler implements IQueryHandler<GetPostQuery, PostResponseDto> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
    @Optional()
    private readonly viewerReactions?: ViewerReactionService,
  ) {}

  async execute(query: GetPostQuery): Promise<PostResponseDto> {
    const postId = PublicationId.create(query.postId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${query.postId} not found`);
    }

    const commentCount =
      (await this.discussionRepository.countActiveByPublicationIds([postId])).get(postId.value) ?? 0;

    const profile = await this.profileRepository.findByMemberId(publication.authorId);
    const author = profile
      ? { displayName: profile.displayName.value, avatarUrl: null }
      : undefined;

    const viewerReaction = this.viewerReactions
      ? (await this.viewerReactions.findByViewer([query.postId], query.viewerId)).get(
          query.postId,
        ) ?? null
      : null;

    return PostResponseDto.fromDomain(publication, commentCount, author, viewerReaction);
  }
}
