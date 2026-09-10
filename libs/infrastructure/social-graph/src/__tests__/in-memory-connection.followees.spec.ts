import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { Connection, ConnectionId } from '@csn/domain-social-graph';
import { InMemoryConnectionRepository } from '../repositories/in-memory-connection.repository';

describe('InMemoryConnectionRepository — findAcceptedFolloweeIds', () => {
  let repo: InMemoryConnectionRepository;
  let follower: UserId;
  let followee: UserId;

  async function connect(
    from: UserId,
    to: UserId,
    outcome: 'accept' | 'reject' | 'pending',
  ): Promise<void> {
    const connection = Connection.request(
      ConnectionId.create(randomUUID()),
      from,
      to,
    );
    if (outcome === 'accept') connection.approve();
    if (outcome === 'reject') connection.reject();
    await repo.save(connection);
  }

  beforeEach(() => {
    repo = new InMemoryConnectionRepository();
    follower = UserId.generate();
    followee = UserId.generate();
  });

  it('should return an empty list when the member follows nobody', async () => {
    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids).toEqual([]);
  });

  it('should return the followee of an accepted connection', async () => {
    // Arrange
    await connect(follower, followee, 'accept');

    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids.map((id) => id.value)).toEqual([followee.value]);
  });

  it('should exclude a pending connection', async () => {
    // Arrange
    await connect(follower, followee, 'pending');

    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids).toEqual([]);
  });

  it('should exclude a rejected connection', async () => {
    // Arrange
    await connect(follower, followee, 'reject');

    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids).toEqual([]);
  });

  it('should not treat an inbound follower as a followee', async () => {
    // Arrange — someone else follows this member
    await connect(followee, follower, 'accept');

    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids).toEqual([]);
  });

  it('should return every accepted followee', async () => {
    // Arrange
    const second = UserId.generate();
    await connect(follower, followee, 'accept');
    await connect(follower, second, 'accept');

    // Act
    const ids = await repo.findAcceptedFolloweeIds(follower);

    // Assert
    expect(ids.map((id) => id.value).sort()).toEqual(
      [followee.value, second.value].sort(),
    );
  });
});
