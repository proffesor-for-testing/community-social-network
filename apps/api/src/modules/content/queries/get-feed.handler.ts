import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Optional } from '@nestjs/common';
import {
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { GetFeedQuery } from './get-feed.query';
import { PostResponseDto } from '../dto/post-response.dto';
import { ViewerReactionService } from '../services/viewer-reaction.service';

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
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    @Optional()
    private readonly viewerReactions?: ViewerReactionService,
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

    // Batch-count active comments per post (one GROUP BY query, no N+1).
    const commentCountByPostId =
      resultItems.length > 0
        ? await this.discussionRepository.countActiveByPublicationIds(
            resultItems.map((p) => p.id),
          )
        : new Map<string, number>();

    // Batch-fetch the viewer's own reactions so the FE can render toggle state.
    const viewerReactionByPostId = this.viewerReactions
      ? await this.viewerReactions.findByViewer(
          resultItems.map((p) => p.id.value),
          query.userId,
        )
      : new Map<string, string>();

    const items = resultItems.map((pub) => {
      const profile = profileByMemberId.get(pub.authorId.value);
      const author = profile
        ? {
            displayName: profile.displayName.value,
            avatarUrl: null, // Avatar URLs not yet served; placeholder for parity.
          }
        : undefined;
      return PostResponseDto.fromDomain(
        pub,
        commentCountByPostId.get(pub.id.value) ?? 0,
        author,
        viewerReactionByPostId.get(pub.id.value) ?? null,
      );
    });

    const nextCursor =
      hasMore && resultItems.length > 0
        ? resultItems[resultItems.length - 1].id.value
        : null;

    return new FeedResult(items, nextCursor, hasMore);
  }
}
