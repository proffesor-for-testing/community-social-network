import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Optional, ForbiddenException } from '@nestjs/common';
import {
  IPublicationRepository,
  IDiscussionRepository,
  GroupId,
  FeedCursor,
} from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { GetGroupFeedQuery } from './get-group-feed.query';
import { FeedResult } from './get-feed.handler';
import { ViewerReactionService } from '../services/viewer-reaction.service';
import { GroupMembershipChecker } from '../services/group-membership-checker.service';
import { enrichPublications } from './enrich-publications';

/**
 * A single group's feed, readable by that group's members only.
 */
@QueryHandler(GetGroupFeedQuery)
export class GetGroupFeedHandler
  implements IQueryHandler<GetGroupFeedQuery, FeedResult>
{
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    @Inject(GroupMembershipChecker)
    private readonly membership: GroupMembershipChecker,
    @Optional()
    private readonly viewerReactions?: ViewerReactionService,
  ) {}

  async execute(query: GetGroupFeedQuery): Promise<FeedResult> {
    const isMember = await this.membership.isActiveMember(
      query.groupId,
      query.viewerId,
    );
    if (!isMember) {
      throw new ForbiddenException('Only group members can read group posts');
    }

    const requestedLimit = query.limit;
    const rows = await this.publicationRepository.findByGroupId(
      GroupId.create(query.groupId),
      {
        cursor: FeedCursor.decode(query.cursor),
        limit: requestedLimit + 1,
      },
    );

    const hasMore = rows.length > requestedLimit;
    const resultItems = hasMore ? rows.slice(0, requestedLimit) : rows;

    const items = await enrichPublications(resultItems, query.viewerId, {
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
