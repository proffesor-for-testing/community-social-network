import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Optional } from '@nestjs/common';
import {
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { GetExploreFeedQuery } from './get-explore-feed.query';
import { FeedResult } from './get-feed.handler';
import { ViewerReactionService } from '../services/viewer-reaction.service';
import { enrichPublications } from './enrich-publications';

/**
 * Explore / trending: every PUBLIC + PUBLISHED post regardless of who the
 * viewer follows. Group posts are excluded by the repository.
 *
 * Kept separate from the personal feed so `findAllPublished` still backs a
 * discovery surface after the main feed became follower-scoped.
 */
@QueryHandler(GetExploreFeedQuery)
export class GetExploreFeedHandler
  implements IQueryHandler<GetExploreFeedQuery, FeedResult>
{
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

  async execute(query: GetExploreFeedQuery): Promise<FeedResult> {
    const allPosts = await this.publicationRepository.findAllPublished();

    let remaining = allPosts;
    if (query.cursor) {
      const cursorIndex = remaining.findIndex((p) => p.id.value === query.cursor);
      if (cursorIndex >= 0) {
        remaining = remaining.slice(cursorIndex + 1);
      }
    }

    const requestedLimit = query.limit;
    const pageItems = remaining.slice(0, requestedLimit + 1);
    const hasMore = pageItems.length > requestedLimit;
    const resultItems = hasMore ? pageItems.slice(0, requestedLimit) : pageItems;

    const items = await enrichPublications(resultItems, query.viewerId, {
      profileRepository: this.profileRepository,
      discussionRepository: this.discussionRepository,
      viewerReactions: this.viewerReactions,
    });

    const nextCursor =
      hasMore && resultItems.length > 0
        ? resultItems[resultItems.length - 1].id.value
        : null;

    return new FeedResult(items, nextCursor, hasMore);
  }
}
