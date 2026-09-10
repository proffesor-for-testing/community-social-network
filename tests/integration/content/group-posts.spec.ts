/**
 * Integration Test: Content — Group Posts
 *
 * Exercises the group publication flow end to end through the CQRS handlers
 * wired to in-memory repositories:
 *   member posts -> group feed shows it -> main feed does not -> outsiders are
 *   refused on both read and write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CommandBus, QueryBus, CqrsModule } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { VisibilityEnum } from '@csn/domain-content';
import {
  GroupId,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';

import { CreatePostHandler } from '../../../apps/api/src/modules/content/commands/create-post.handler';
import { CreatePostCommand } from '../../../apps/api/src/modules/content/commands/create-post.command';
import { CreateGroupPostHandler } from '../../../apps/api/src/modules/content/commands/create-group-post.handler';
import { CreateGroupPostCommand } from '../../../apps/api/src/modules/content/commands/create-group-post.command';
import { GetGroupFeedHandler } from '../../../apps/api/src/modules/content/queries/get-group-feed.handler';
import { GetGroupFeedQuery } from '../../../apps/api/src/modules/content/queries/get-group-feed.query';
import { GetFeedHandler } from '../../../apps/api/src/modules/content/queries/get-feed.handler';
import { GetFeedQuery } from '../../../apps/api/src/modules/content/queries/get-feed.query';
import { GetPostHandler } from '../../../apps/api/src/modules/content/queries/get-post.handler';
import { GetPostQuery } from '../../../apps/api/src/modules/content/queries/get-post.query';
import { GetExploreFeedHandler } from '../../../apps/api/src/modules/content/queries/get-explore-feed.handler';
import { GetExploreFeedQuery } from '../../../apps/api/src/modules/content/queries/get-explore-feed.query';
import { GroupMembershipChecker } from '../../../apps/api/src/modules/content/services/group-membership-checker.service';

import {
  createTestRepositories,
  TestRepositories,
  PUBLICATION_REPOSITORY_TOKEN,
  DISCUSSION_REPOSITORY_TOKEN,
  PROFILE_REPOSITORY_TOKEN,
  CONNECTION_REPOSITORY_TOKEN,
  MEMBERSHIP_REPOSITORY,
} from '../../setup/test-app';

describe('Content: Group Posts', () => {
  let module: TestingModule;
  let repos: TestRepositories;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  const groupId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();

  beforeEach(async () => {
    repos = createTestRepositories();

    await repos.membershipRepo.save(
      Membership.create(
        MembershipId.generate(),
        GroupId.create(groupId),
        UserId.create(memberId),
        MembershipRole.MEMBER,
      ),
    );

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreatePostHandler,
        CreateGroupPostHandler,
        GetGroupFeedHandler,
        GetFeedHandler,
        GetPostHandler,
        GetExploreFeedHandler,
        GroupMembershipChecker,
        { provide: PUBLICATION_REPOSITORY_TOKEN, useValue: repos.publicationRepo },
        { provide: DISCUSSION_REPOSITORY_TOKEN, useValue: repos.discussionRepo },
        { provide: PROFILE_REPOSITORY_TOKEN, useValue: repos.profileRepo },
        { provide: CONNECTION_REPOSITORY_TOKEN, useValue: repos.connectionRepo },
        { provide: MEMBERSHIP_REPOSITORY, useValue: repos.membershipRepo },
      ],
    }).compile();

    await module.init();
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  async function postToGroup(authorId: string, content = 'Group announcement') {
    return commandBus.execute(
      new CreateGroupPostCommand(groupId, authorId, content),
    );
  }

  it('should let an active member create a group post', async () => {
    // Act
    const result = await postToGroup(memberId);

    // Assert
    expect(result.publicationId).toBeDefined();
  });

  it('should show the group post in the group feed for a member', async () => {
    // Arrange
    const created = await postToGroup(memberId);

    // Act
    const feed = await queryBus.execute(
      new GetGroupFeedQuery(groupId, memberId),
    );

    // Assert
    expect(feed.items.map((i: { id: string }) => i.id)).toEqual([
      created.publicationId,
    ]);
  });

  it('should keep the group post out of the author main feed', async () => {
    // Arrange
    await postToGroup(memberId);

    // Act
    const feed = await queryBus.execute(new GetFeedQuery(memberId));

    // Assert
    expect(feed.items).toEqual([]);
  });

  it('should keep the group post out of the Explore feed', async () => {
    // Arrange
    await postToGroup(memberId);

    // Act
    const explore = await queryBus.execute(new GetExploreFeedQuery());

    // Assert
    expect(explore.items).toEqual([]);
  });

  it('should still keep personal posts on the author main feed', async () => {
    // Arrange
    await postToGroup(memberId);
    const personal = await commandBus.execute(
      new CreatePostCommand(memberId, 'Personal post', VisibilityEnum.PUBLIC),
    );

    // Act
    const feed = await queryBus.execute(new GetFeedQuery(memberId));

    // Assert
    expect(feed.items.map((i: { id: string }) => i.id)).toEqual([
      personal.publicationId,
    ]);
  });

  it('should refuse a group post from a non-member', async () => {
    // Act / Assert
    await expect(postToGroup(outsiderId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should refuse the group feed to a non-member', async () => {
    // Arrange
    await postToGroup(memberId);

    // Act / Assert
    await expect(
      queryBus.execute(new GetGroupFeedQuery(groupId, outsiderId)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should still resolve a group post through the post detail query', async () => {
    // Arrange
    const created = await postToGroup(memberId, 'Detail me');

    // Act
    const post = await queryBus.execute(new GetPostQuery(created.publicationId));

    // Assert
    expect(post.content).toBe('Detail me');
  });

  it('should expose the group id on the post detail response', async () => {
    // Arrange
    const created = await postToGroup(memberId);

    // Act
    const post = await queryBus.execute(new GetPostQuery(created.publicationId));

    // Assert
    expect(post.groupId).toBe(groupId);
  });

  it('should refuse a group post after the author leaves the group', async () => {
    // Arrange
    const membership = await repos.membershipRepo.findByGroupAndMember(
      GroupId.create(groupId),
      UserId.create(memberId),
    );
    await repos.membershipRepo.delete(membership!);

    // Act / Assert
    await expect(postToGroup(memberId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
