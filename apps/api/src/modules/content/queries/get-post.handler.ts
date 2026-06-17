import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import {
  PublicationId,
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { GetPostQuery } from './get-post.query';
import { PostResponseDto } from '../dto/post-response.dto';

@QueryHandler(GetPostQuery)
export class GetPostHandler implements IQueryHandler<GetPostQuery, PostResponseDto> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetPostQuery): Promise<PostResponseDto> {
    const postId = PublicationId.create(query.postId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${query.postId} not found`);
    }

    const discussions = await this.discussionRepository.findByPublicationId(postId);
    const commentCount = discussions.length;

    const profile = await this.profileRepository.findByMemberId(publication.authorId);
    const author = profile
      ? { displayName: profile.displayName.value, avatarUrl: null }
      : undefined;

    return PostResponseDto.fromDomain(publication, commentCount, author);
  }
}
