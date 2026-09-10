/**
 * Integration Test: Social Graph -> Content — Follower-Based Feed
 *
 * Follows the social graph through to the read side: a follow request alone
 * changes nothing, approval pulls the followee's posts into the feed, and
 * unfollowing (via block) removes them again.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, QueryBus, CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { VisibilityEnum } from '@csn/domain-content';

import { CreatePostHandler } from '../../../apps/api/src/modules/content/commands/create-post.handler';
import { CreatePostCommand } from '../../../apps/api/src/modules/content/commands/create-post.command';
import { GetFeedHandler } from '../../../apps/api/src/modules/content/queries/get-feed.handler';
import { GetFeedQuery } from '../../../apps/api/src/modules/content/queries/get-feed.query';
import { FollowMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/follow-member.handler';
import { FollowMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/follow-member.command';
import { ApproveFollowHandler } from '../../../apps/api/src/modules/social-graph/commands/approve-follow.handler';
import { ApproveFollowCommand } from '../../../apps/api/src/modules/social-graph/commands/approve-follow.command';

import {
  createTestRepositories,
  TestRepositories,
  PUBLICATION_REPOSITORY_TOKEN,
  DISCUSSION_REPOSITORY_TOKEN,
  PROFILE_REPOSITORY_TOKEN,
  CONNECTION_REPOSITORY_TOKEN,
} from '../../setup/test-app';

describe('Social Graph -> Content: Follower-Based Feed', () => {
  let module: TestingModule;
  let repos: TestRepositories;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let followHandler: FollowMemberHandler;
  let approveHandler: ApproveFollowHandler;

  const viewerId = randomUUID();
  const authorId = randomUUID();
  const strangerId = randomUUID();

  const noAlerts = { create: async () => undefined } as never;

  beforeEach(async () => {
    repos = createTestRepositories();

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreatePostHandler,
        GetFeedHandler,
        { provide: PUBLICATION_REPOSITORY_TOKEN, useValue: repos.publicationRepo },
        { provide: DISCUSSION_REPOSITORY_TOKEN, useValue: repos.discussionRepo },
        { provide: PROFILE_REPOSITORY_TOKEN, useValue: repos.profileRepo },
        { provide: CONNECTION_REPOSITORY_TOKEN, useValue: repos.connectionRepo },
      ],
    }).compile();

    await module.init();
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);

    followHandler = new FollowMemberHandler(
      repos.connectionRepo,
      repos.blockRepo,
      noAlerts,
    );
    approveHandler = new ApproveFollowHandler(repos.connectionRepo, noAlerts);
  });

  async function publish(author: string, content: string): Promise<string> {
    const result = await commandBus.execute(
      new CreatePostCommand(author, content, VisibilityEnum.PUBLIC),
    );
    return result.publicationId;
  }

  async function feedFor(userId: string) {
    return queryBus.execute(new GetFeedQuery(userId));
  }

  it('should show nothing to a viewer who follows nobody and posts nothing', async () => {
    // Arrange
    await publish(authorId, 'Not for you');

    // Act
    const feed = await feedFor(viewerId);

    // Assert
    expect(feed.items).toEqual([]);
  });

  it('should show the viewer their own post', async () => {
    // Arrange
    const own = await publish(viewerId, 'My own post');

    // Act
    const feed = await feedFor(viewerId);

    // Assert
    expect(feed.items.map((i: { id: string }) => i.id)).toEqual([own]);
  });

  it('should not show a followee post while the request is still pending', async () => {
    // Arrange
    await publish(authorId, 'Author post');
    await followHandler.execute(new FollowMemberCommand(viewerId, authorId));

    // Act
    const feed = await feedFor(viewerId);

    // Assert
    expect(feed.items).toEqual([]);
  });

  it('should show the followee post once the follow is approved', async () => {
    // Arrange
    const post = await publish(authorId, 'Author post');
    const connection = await followHandler.execute(
      new FollowMemberCommand(viewerId, authorId),
    );
    await approveHandler.execute(
      new ApproveFollowCommand(connection.id, authorId),
    );

    // Act
    const feed = await feedFor(viewerId);

    // Assert
    expect(feed.items.map((i: { id: string }) => i.id)).toEqual([post]);
  });

  it('should still exclude posts by members outside the following list', async () => {
    // Arrange
    await publish(strangerId, 'Stranger post');
    const connection = await followHandler.execute(
      new FollowMemberCommand(viewerId, authorId),
    );
    await approveHandler.execute(
      new ApproveFollowCommand(connection.id, authorId),
    );
    await publish(authorId, 'Author post');

    // Act
    const feed = await feedFor(viewerId);

    // Assert
    expect(feed.items.map((i: { content: string }) => i.content)).toEqual([
      'Author post',
    ]);
  });

  it('should not leak the viewer feed to the followee in reverse', async () => {
    // Arrange — viewer follows author; the author does not follow back
    await publish(viewerId, 'Viewer post');
    const connection = await followHandler.execute(
      new FollowMemberCommand(viewerId, authorId),
    );
    await approveHandler.execute(
      new ApproveFollowCommand(connection.id, authorId),
    );

    // Act
    const feed = await feedFor(authorId);

    // Assert
    expect(feed.items).toEqual([]);
  });
});
