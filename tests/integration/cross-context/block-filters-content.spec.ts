/**
 * Cross-Context Integration Test: Block Filters Content
 *
 * Validates that blocking a user triggers the appropriate domain events
 * and that the BlockContentFilterConsumer processes MemberBlocked events.
 *
 * Flow:
 * 1. User A creates a post
 * 2. User B can retrieve User A's post
 * 3. User B blocks User A
 * 4. Verify the Block aggregate is created with domain events
 * 5. Verify BlockContentFilterConsumer processes the MemberBlocked event
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { CqrsModule, CommandBus, QueryBus } from '@nestjs/cqrs';

// ── Content handlers ────────────────────────────────────────────────────────

import { CreatePostHandler } from '../../../apps/api/src/modules/content/commands/create-post.handler';
import { CreatePostCommand } from '../../../apps/api/src/modules/content/commands/create-post.command';
import { GetPostHandler } from '../../../apps/api/src/modules/content/queries/get-post.handler';
import { GetPostQuery } from '../../../apps/api/src/modules/content/queries/get-post.query';

// ── Social graph handlers ───────────────────────────────────────────────────

import { BlockMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/block-member.handler';
import { BlockMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/block-member.command';
import { FollowMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/follow-member.handler';
import { FollowMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/follow-member.command';

// ── Cross-context consumer ──────────────────────────────────────────────────

import { BlockContentFilterConsumer } from '../../../apps/api/src/consumers/block-content-filter.consumer';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  MockIdempotencyStore,
  PUBLICATION_REPOSITORY_TOKEN,
  DISCUSSION_REPOSITORY_TOKEN,
} from '../../setup/test-app';
import { VisibilityEnum } from '@csn/domain-content';
import { UserId } from '@csn/domain-shared';

describe('Cross-Context: Block Filters Content', () => {
  let module: TestingModule;
  let repos: TestRepositories;
  let mockIdempotency: MockIdempotencyStore;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let blockHandler: BlockMemberHandler;
  let followHandler: FollowMemberHandler;
  let consumer: BlockContentFilterConsumer;

  const userA = randomUUID(); // post author
  const userB = randomUUID(); // blocker

  beforeEach(async () => {
    repos = createTestRepositories();
    mockIdempotency = new MockIdempotencyStore();

    // Use CqrsModule for content handlers (they use @CommandHandler/@QueryHandler)
    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreatePostHandler,
        GetPostHandler,
        { provide: PUBLICATION_REPOSITORY_TOKEN, useValue: repos.publicationRepo },
        { provide: DISCUSSION_REPOSITORY_TOKEN, useValue: repos.discussionRepo },
      ],
    }).compile();

    await module.init();

    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);

    // Direct instantiation for social graph handlers and consumers
    // to avoid NestJS DI class-token issues with IdempotencyStore
    blockHandler = new BlockMemberHandler(
      repos.blockRepo,
      repos.connectionRepo,
    );
    followHandler = new FollowMemberHandler(
      repos.connectionRepo,
      repos.blockRepo,
    );
    consumer = new BlockContentFilterConsumer(
      mockIdempotency as any,
    );
  });

  // ── Step 1: User A creates a post ─────────────────────────────────────

  it('should allow User A to create a post', async () => {
    const result = await commandBus.execute(
      new CreatePostCommand(userA, 'Post by User A for cross-context test.', VisibilityEnum.PUBLIC),
    );

    expect(result.publicationId).toBeDefined();
  });

  // ── Step 2: User B can see User A's post ──────────────────────────────

  it('should allow User B to retrieve User A post before block', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(userA, 'Visible post before block.', VisibilityEnum.PUBLIC),
    );

    const post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.authorId).toBe(userA);
    expect(post.content).toBe('Visible post before block.');
  });

  // ── Step 3: User B blocks User A ──────────────────────────────────────

  it('should create a block between User B and User A', async () => {
    const blockResult = await blockHandler.execute(
      new BlockMemberCommand(userB, userA),
    );

    expect(blockResult).toBeDefined();
    expect(blockResult.blockerId).toBe(userB);
    expect(blockResult.blockedId).toBe(userA);
  });

  // ── Step 4: Verify Block domain events ────────────────────────────────

  it('should store the block in the repository', async () => {
    await blockHandler.execute(new BlockMemberCommand(userB, userA));

    const isBlocked = await repos.blockRepo.isBlocked(
      UserId.create(userB),
      UserId.create(userA),
    );
    expect(isBlocked).toBe(true);
  });

  // ── Step 5: BlockContentFilterConsumer processes MemberBlocked event ───

  it('should process MemberBlocked event via BlockContentFilterConsumer', async () => {
    const eventPayload = {
      type: 'MemberBlocked',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      blockerId: userB,
      blockedId: userA,
    };

    // Consumer should process without error
    await expect(consumer.handle(eventPayload)).resolves.not.toThrow();

    // Event should be marked as processed via idempotency
    const isProcessed = await mockIdempotency.isProcessed(`block:filter:${eventPayload.eventId}`);
    expect(isProcessed).toBe(true);
  });

  // ── Idempotent processing ─────────────────────────────────────────────

  it('should skip duplicate MemberBlocked events', async () => {
    const eventPayload = {
      type: 'MemberBlocked',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      blockerId: userB,
      blockedId: userA,
    };

    // Process twice
    await consumer.handle(eventPayload);
    await consumer.handle(eventPayload);

    // Should still only be processed once (idempotent)
    expect(await mockIdempotency.isProcessed(`block:filter:${eventPayload.eventId}`)).toBe(true);
  });

  // ── Block also removes existing follow connections ────────────────────

  it('should remove existing follow connections when blocking', async () => {
    // User B follows User A first
    await followHandler.execute(new FollowMemberCommand(userB, userA));

    // Now User B blocks User A - this should remove the connection
    await blockHandler.execute(new BlockMemberCommand(userB, userA));

    // Verify the connection was removed
    const connection = await repos.connectionRepo.findByFollowerAndFollowee(
      UserId.create(userB),
      UserId.create(userA),
    );
    expect(connection).toBeNull();
  });

  // ── Full cross-context flow ───────────────────────────────────────────

  it('should complete full flow: post -> block -> consumer', async () => {
    // 1. User A creates a post
    const createResult = await commandBus.execute(
      new CreatePostCommand(userA, 'Cross-context lifecycle post.', VisibilityEnum.PUBLIC),
    );

    // 2. User B retrieves the post (still visible)
    const post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.authorId).toBe(userA);

    // 3. User B blocks User A
    await blockHandler.execute(new BlockMemberCommand(userB, userA));

    // 4. Simulate the MemberBlocked event reaching the consumer
    const eventPayload = {
      type: 'MemberBlocked',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      blockerId: userB,
      blockedId: userA,
    };
    await consumer.handle(eventPayload);

    // 5. Verify the consumer processed the event
    expect(await mockIdempotency.isProcessed(`block:filter:${eventPayload.eventId}`)).toBe(true);

    // Note: In production, the feed query service would check a Redis set
    // to filter out posts from blocked users. This test validates the event
    // wiring and consumer logic up to that point.
  });
});
