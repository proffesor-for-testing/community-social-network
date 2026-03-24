import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  PublicationId,
  IPublicationRepository,
} from '@csn/domain-content';
import { GetFeedQuery } from './get-feed.query';
import { PostResponseDto } from '../dto/post-response.dto';

export class FeedResult {
  constructor(
    public readonly items: PostResponseDto[],
    public readonly nextCursor: string | null,
    public readonly hasMore: boolean,
  ) {}
}

@QueryHandler(GetFeedQuery)
export class GetFeedHandler implements IQueryHandler<GetFeedQuery, FeedResult> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(query: GetFeedQuery): Promise<FeedResult> {
    const userId = UserId.create(query.userId);

    // For now, the feed returns the user's own posts ordered by creation date
    // with cursor-based pagination. A full social feed (with followed users'
    // posts) would require a FeedService or read-model, which is a Phase 5+ concern.
    const allPosts = await this.publicationRepository.findByAuthorId(userId);

    // Sort by createdAt descending (newest first) -- repository already returns DESC
    let filtered = allPosts;

    // Apply cursor: skip posts until we find the cursor post, then take the next batch
    if (query.cursor) {
      const cursorIndex = filtered.findIndex(
        (p) => p.id.value === query.cursor,
      );
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to determine if there are more items
    const requestedLimit = query.limit;
    const pageItems = filtered.slice(0, requestedLimit + 1);
    const hasMore = pageItems.length > requestedLimit;
    const resultItems = hasMore ? pageItems.slice(0, requestedLimit) : pageItems;

    const items = resultItems.map((pub) => PostResponseDto.fromDomain(pub));
    const nextCursor = hasMore && resultItems.length > 0
      ? resultItems[resultItems.length - 1].id
      : null;

    return new FeedResult(items, nextCursor, hasMore);
  }
}
