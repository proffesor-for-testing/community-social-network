/**
 * Persistence: PostgresConnectionRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { ConnectionStatusEnum } from '@csn/domain-social-graph';
import { RUN_DB_TESTS, truncateAll, getConnectionRepository, createTestConnection } from '../setup/db';
import type { PostgresConnectionRepository } from '@csn/infra-social-graph';

describe.skipIf(!RUN_DB_TESTS)('PostgresConnectionRepository', () => {
  let repository: PostgresConnectionRepository;

  beforeAll(async () => {
    repository = await getConnectionRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a connection through save and findById', async () => {
    const followerId = randomUUID();
    const followeeId = randomUUID();
    const connection = createTestConnection(followerId, followeeId);

    await repository.save(connection);
    const found = await repository.findById(connection.id);

    expect(found?.status.value).toBe(ConnectionStatusEnum.PENDING);
  });

  it('findByFollowerAndFollowee finds the connection in the requested direction', async () => {
    const followerId = randomUUID();
    const followeeId = randomUUID();
    const connection = createTestConnection(followerId, followeeId);
    await repository.save(connection);

    const found = await repository.findByFollowerAndFollowee(
      UserId.create(followerId),
      UserId.create(followeeId),
    );

    expect(found?.id.value).toBe(connection.id.value);
  });

  it('findByFollowerAndFollowee returns null for the reverse direction', async () => {
    const followerId = randomUUID();
    const followeeId = randomUUID();
    await repository.save(createTestConnection(followerId, followeeId));

    // Reversed: followeeId following followerId is a distinct (nonexistent) connection.
    const reversed = await repository.findByFollowerAndFollowee(
      UserId.create(followeeId),
      UserId.create(followerId),
    );

    expect(reversed).toBeNull();
  });

  it('findFollowers returns connections where the user is the followee', async () => {
    const userId = randomUUID();
    const followerA = randomUUID();
    const followerB = randomUUID();
    await repository.save(createTestConnection(followerA, userId));
    await repository.save(createTestConnection(followerB, userId));
    // Unrelated connection where userId is the follower, not the followee.
    await repository.save(createTestConnection(userId, randomUUID()));

    const followers = await repository.findFollowers(UserId.create(userId));

    expect(followers.map((c) => c.followerId.value).sort()).toEqual([followerA, followerB].sort());
  });

  it('findFollowing returns connections where the user is the follower', async () => {
    const userId = randomUUID();
    const followeeA = randomUUID();
    const followeeB = randomUUID();
    await repository.save(createTestConnection(userId, followeeA));
    await repository.save(createTestConnection(userId, followeeB));

    const following = await repository.findFollowing(UserId.create(userId));

    expect(following.map((c) => c.followeeId.value).sort()).toEqual([followeeA, followeeB].sort());
  });

  it('countFollowers counts connections regardless of status', async () => {
    const userId = randomUUID();
    const connection = createTestConnection(randomUUID(), userId);
    connection.approve();
    await repository.save(connection);
    await repository.save(createTestConnection(randomUUID(), userId));

    const count = await repository.countFollowers(UserId.create(userId));

    expect(count).toBe(2);
  });

  it('countFollowing counts connections where the user is the follower', async () => {
    const userId = randomUUID();
    await repository.save(createTestConnection(userId, randomUUID()));
    await repository.save(createTestConnection(userId, randomUUID()));
    await repository.save(createTestConnection(randomUUID(), userId));

    const count = await repository.countFollowing(UserId.create(userId));

    expect(count).toBe(2);
  });
});
