import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Optional } from '@nestjs/common';
import {
  IPublicationRepository,
  IDiscussionRepository,
  FeedCursor,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { IConnectionRepository } from '@csn/domain-social-graph';
import { UserId } from '@csn/domain-shared';
import { GetFeedQuery } from './get-feed.query';
import { PostResponseDto } from '../dto/post-response.dto';
import { ViewerReactionService } from '../services/viewer-reaction.service';
import { enrichPublications } from './enrich-publications';

export class FeedResult {
  constructor(
    public readonly items: PostResponseDto[],
    public readonly nextCursor: string | null,
    public readonly hasMore: boolean,
  ) {}
}

/**
 * The viewer's personal feed: their own posts plus posts by everyone they
 * follow with an ACCEPTED connection. Group posts are excluded — they live
 * behind the group's own feed.
 */
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
    // Declared optional only because TypeScript forbids a required parameter
    // after an optional one; DI always supplies it via the explicit token.
    @Inject('IConnectionRepository')
    private readonly connectionRepository?: IConnectionRepository,
  ) {}

  async execute(query: GetFeedQuery): Promise<FeedResult> {
    if (!this.connectionRepository) {
      throw new Error(
        'GetFeedHandler requires an IConnectionRepository to resolve followees',
      );
    }

    const viewerId = UserId.create(query.userId);
    const followeeIds =
      await this.connectionRepository.findAcceptedFolloweeIds(viewerId);

    // The viewer always sees their own posts, even with an empty following list.
    const authorIds = dedupeUserIds([viewerId, ...followeeIds]);

    const requestedLimit = query.limit;
    // Fetch one extra row to detect a further page without a second count query.
    const rows = await this.publicationRepository.findFeedForAuthors(authorIds, {
      cursor: FeedCursor.decode(query.cursor),
      limit: requestedLimit + 1,
    });

    const hasMore = rows.length > requestedLimit;
    const resultItems = hasMore ? rows.slice(0, requestedLimit) : rows;

    const items = await enrichPublications(resultItems, query.userId, {
      profileRepository: this.profileRepository,
      discussionRepository: this.discussionRepository,
      viewerReactions: this.viewerReactions,
    });

    const last = resultItems[resultItems.length - 1];
    const nextCursor =
      hasMore && last
        ? FeedCursor.encode({ createdAt: last.createdAt.value, id: last.id.value })
        : null;

    return new FeedResult(items, nextCursor, hasMore);
  }
}

function dedupeUserIds(ids: UserId[]): UserId[] {
  const seen = new Set<string>();
  const unique: UserId[] = [];
  for (const id of ids) {
    if (!seen.has(id.value)) {
      seen.add(id.value);
      unique.push(id);
    }
  }
  return unique;
}
