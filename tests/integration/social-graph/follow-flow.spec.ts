/**
 * Integration Test: Social Graph - Follow / Unfollow Flow
 *
 * Exercises the follow lifecycle through the real handlers wired
 * to in-memory repositories.
 *
 * Flow:
 * 1. User A follows User B (creates PENDING connection)
 * 2. User B approves the follow request
 * 3. Verify A appears in B's followers
 * 4. Verify B appears in A's following
 * 5. User A unfollows User B
 * 6. Verify lists are updated
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

// ── Handlers ────────────────────────────────────────────────────────────────

import { FollowMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/follow-member.handler';
import { FollowMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/follow-member.command';
import { ApproveFollowHandler } from '../../../apps/api/src/modules/social-graph/commands/approve-follow.handler';
import { ApproveFollowCommand } from '../../../apps/api/src/modules/social-graph/commands/approve-follow.command';
import { UnfollowMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/unfollow-member.handler';
import { UnfollowMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/unfollow-member.command';
import { GetFollowersHandler } from '../../../apps/api/src/modules/social-graph/queries/get-followers.handler';
import { GetFollowersQuery } from '../../../apps/api/src/modules/social-graph/queries/get-followers.query';
import { GetFollowingHandler } from '../../../apps/api/src/modules/social-graph/queries/get-following.handler';
import { GetFollowingQuery } from '../../../apps/api/src/modules/social-graph/queries/get-following.query';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  CONNECTION_REPOSITORY_TOKEN,
  BLOCK_REPOSITORY_TOKEN,
} from '../../setup/test-app';

describe('Social Graph: Follow / Unfollow Flow', () => {
  let module: TestingModule;
  let repos: TestRepositories;

  let followHandler: FollowMemberHandler;
  let approveHandler: ApproveFollowHandler;
  let unfollowHandler: UnfollowMemberHandler;
  let getFollowersHandler: GetFollowersHandler;
  let getFollowingHandler: GetFollowingHandler;

  const userA = randomUUID(); // follower
  const userB = randomUUID(); // followee
  const userC = randomUUID(); // third user

  beforeEach(async () => {
    repos = createTestRepositories();

    module = await Test.createTestingModule({
      providers: [
        FollowMemberHandler,
        ApproveFollowHandler,
        UnfollowMemberHandler,
        GetFollowersHandler,
        GetFollowingHandler,
        { provide: CONNECTION_REPOSITORY_TOKEN, useValue: repos.connectionRepo },
        { provide: BLOCK_REPOSITORY_TOKEN, useValue: repos.blockRepo },
      ],
    }).compile();

    followHandler = module.get(FollowMemberHandler);
    approveHandler = module.get(ApproveFollowHandler);
    unfollowHandler = module.get(UnfollowMemberHandler);
    getFollowersHandler = module.get(GetFollowersHandler);
    getFollowingHandler = module.get(GetFollowingHandler);
  });

  // ── Step 1: User A follows User B ─────────────────────────────────────

  it('should create a PENDING follow request', async () => {
    const command = new FollowMemberCommand(userA, userB);
    const result = await followHandler.execute(command);

    expect(result.id).toBeDefined();
    expect(result.followerId).toBe(userA);
    expect(result.followeeId).toBe(userB);
    expect(result.status).toBe('PENDING');
  });

  // ── Self-follow prevention ────────────────────────────────────────────

  it('should reject self-follow', async () => {
    const command = new FollowMemberCommand(userA, userA);
    await expect(followHandler.execute(command)).rejects.toThrow(BadRequestException);
  });

  // ── Duplicate follow prevention ───────────────────────────────────────

  it('should reject duplicate follow request', async () => {
    await followHandler.execute(new FollowMemberCommand(userA, userB));
    await expect(
      followHandler.execute(new FollowMemberCommand(userA, userB)),
    ).rejects.toThrow(ConflictException);
  });

  // ── Step 2: User B approves the follow ────────────────────────────────

  it('should approve a pending follow request', async () => {
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );

    const approveCommand = new ApproveFollowCommand(followResult.id, userB);
    const approved = await approveHandler.execute(approveCommand);

    expect(approved.status).toBe('ACCEPTED');
  });

  // ── Non-followee cannot approve ───────────────────────────────────────

  it('should reject approval by non-followee', async () => {
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );

    const approveCommand = new ApproveFollowCommand(followResult.id, userC);
    await expect(approveHandler.execute(approveCommand)).rejects.toThrow(ForbiddenException);
  });

  // ── Step 3: Verify A appears in B's followers ─────────────────────────

  it('should list User A in User B followers after approval', async () => {
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );
    await approveHandler.execute(new ApproveFollowCommand(followResult.id, userB));

    const followers = await getFollowersHandler.execute(new GetFollowersQuery(userB));

    expect(followers.total).toBe(1);
    expect(followers.items).toHaveLength(1);
    expect(followers.items[0].followerId).toBe(userA);
  });

  // ── Step 4: Verify B appears in A's following ─────────────────────────

  it('should list User B in User A following after approval', async () => {
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );
    await approveHandler.execute(new ApproveFollowCommand(followResult.id, userB));

    const following = await getFollowingHandler.execute(new GetFollowingQuery(userA));

    expect(following.total).toBe(1);
    expect(following.items).toHaveLength(1);
    expect(following.items[0].followeeId).toBe(userB);
  });

  // ── PENDING connections should NOT appear in followers/following ───────

  it('should not include PENDING connections in followers list', async () => {
    await followHandler.execute(new FollowMemberCommand(userA, userB));
    // Not approved yet

    const followers = await getFollowersHandler.execute(new GetFollowersQuery(userB));
    expect(followers.total).toBe(0);

    const following = await getFollowingHandler.execute(new GetFollowingQuery(userA));
    expect(following.total).toBe(0);
  });

  // ── Step 5: User A unfollows User B ───────────────────────────────────

  it('should allow unfollowing an accepted connection', async () => {
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );
    await approveHandler.execute(new ApproveFollowCommand(followResult.id, userB));

    // Verify the connection exists before unfollowing
    let following = await getFollowingHandler.execute(new GetFollowingQuery(userA));
    expect(following.total).toBe(1);

    // Unfollow
    await unfollowHandler.execute(new UnfollowMemberCommand(userA, userB));

    // Step 6: Verify lists are updated
    following = await getFollowingHandler.execute(new GetFollowingQuery(userA));
    expect(following.total).toBe(0);

    const followers = await getFollowersHandler.execute(new GetFollowersQuery(userB));
    expect(followers.total).toBe(0);
  });

  // ── Unfollow non-existent connection ──────────────────────────────────

  it('should throw NotFoundException when unfollowing non-existent connection', async () => {
    await expect(
      unfollowHandler.execute(new UnfollowMemberCommand(userA, userC)),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Blocked user cannot follow ────────────────────────────────────────

  it('should prevent follow when user is blocked', async () => {
    // Pre-populate a block: userB blocked userA
    const { Block, BlockId } = await import('@csn/domain-social-graph');
    const { UserId } = await import('@csn/domain-shared');
    const blockId = BlockId.create(randomUUID());
    const block = Block.create(blockId, UserId.create(userB), UserId.create(userA));
    await repos.blockRepo.save(block);

    // userA tries to follow userB
    await expect(
      followHandler.execute(new FollowMemberCommand(userA, userB)),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Full lifecycle test ───────────────────────────────────────────────

  it('should complete full follow -> approve -> verify -> unfollow -> verify flow', async () => {
    // 1. Follow
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );
    expect(followResult.status).toBe('PENDING');

    // 2. Approve
    await approveHandler.execute(new ApproveFollowCommand(followResult.id, userB));

    // 3. Verify followers/following
    let followers = await getFollowersHandler.execute(new GetFollowersQuery(userB));
    expect(followers.total).toBe(1);

    let following = await getFollowingHandler.execute(new GetFollowingQuery(userA));
    expect(following.total).toBe(1);

    // 4. Unfollow
    await unfollowHandler.execute(new UnfollowMemberCommand(userA, userB));

    // 5. Verify lists are empty
    followers = await getFollowersHandler.execute(new GetFollowersQuery(userB));
    expect(followers.total).toBe(0);

    following = await getFollowingHandler.execute(new GetFollowingQuery(userA));
    expect(following.total).toBe(0);
  });
});
