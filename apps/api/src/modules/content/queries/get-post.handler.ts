import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import {
  PublicationId,
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { GetPostQuery } from './get-post.query';
import { PostResponseDto } from '../dto/post-response.dto';

@QueryHandler(GetPostQuery)
export class GetPostHandler implements IQueryHandler<GetPostQuery, PostResponseDto> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
  ) {}

  async execute(query: GetPostQuery): Promise<PostResponseDto> {
    const postId = PublicationId.create(query.postId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${query.postId} not found`);
    }

    const discussions = await this.discussionRepository.findByPublicationId(postId);
    const commentCount = discussions.length;

    return PostResponseDto.fromDomain(publication, commentCount);
  }
}
