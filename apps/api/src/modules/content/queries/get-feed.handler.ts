import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  IPublicationRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
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
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetFeedQuery): Promise<FeedResult> {
    // Until follower-based feeds are wired up, return all PUBLIC + PUBLISHED posts.
    const allPosts = await this.publicationRepository.findAllPublished();

    let filtered = allPosts;
    if (query.cursor) {
      const cursorIndex = filtered.findIndex((p) => p.id.value === query.cursor);
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      }
    }

    const requestedLimit = query.limit;
    const pageItems = filtered.slice(0, requestedLimit + 1);
    const hasMore = pageItems.length > requestedLimit;
    const resultItems = hasMore ? pageItems.slice(0, requestedLimit) : pageItems;

    // Batch-fetch author profiles in a single round-trip so authorName /
    // authorAvatarUrl land on the DTO without N+1 queries.
    const uniqueAuthorIds = Array.from(
      new Set(resultItems.map((p) => p.authorId.value)),
    ).map((id) => UserId.create(id));
    const profileByMemberId =
      uniqueAuthorIds.length > 0
        ? await this.profileRepository.findByMemberIds(uniqueAuthorIds)
        : new Map();

    const items = resultItems.map((pub) => {
      const profile = profileByMemberId.get(pub.authorId.value);
      const author = profile
        ? {
            displayName: profile.displayName.value,
            avatarUrl: null, // Avatar URLs not yet served; placeholder for parity.
          }
        : undefined;
      return PostResponseDto.fromDomain(pub, undefined, author);
    });

    const nextCursor =
      hasMore && resultItems.length > 0
        ? resultItems[resultItems.length - 1].id.value
        : null;

    return new FeedResult(items, nextCursor, hasMore);
  }
}
