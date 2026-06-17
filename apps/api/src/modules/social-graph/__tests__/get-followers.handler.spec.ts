import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Email } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
} from '@csn/domain-social-graph';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { GetFollowersHandler } from '../queries/get-followers.handler';
import { GetFollowersQuery } from '../queries/get-followers.query';

function makeAcceptedConnection(follower: UserId, followee: UserId): Connection {
  const conn = Connection.request(ConnectionId.generate(), follower, followee);
  conn.approve();
  return conn;
}

function makeProfile(memberId: UserId, name: string): Profile {
  return Profile.create(
    ProfileId.generate(),
    memberId,
    DisplayName.create(name),
    Email.create(`${name.toLowerCase().replace(/\s+/g, '.')}@test.local`),
  );
}

class StubConnectionRepo {
  constructor(private readonly connections: Connection[]) {}
  async findFollowers(): Promise<Connection[]> {
    return this.connections;
  }
}

class StubProfileRepo {
  public calls: UserId[][] = [];
  constructor(private readonly profiles: Map<string, Profile>) {}
  async findByMemberIds(ids: UserId[]): Promise<Map<string, Profile>> {
    this.calls.push(ids);
    const out = new Map<string, Profile>();
    for (const id of ids) {
      const p = this.profiles.get(id.value);
      if (p) out.set(id.value, p);
    }
    return out;
  }
}

describe('GetFollowersHandler — author enrichment', () => {
  let viewer: UserId;
  let alice: UserId;
  let bob: UserId;
  let connections: Connection[];
  let profiles: Map<string, Profile>;

  beforeEach(() => {
    // Arrange (shared)
    viewer = UserId.generate();
    alice = UserId.generate();
    bob = UserId.generate();
    connections = [
      makeAcceptedConnection(alice, viewer),
      makeAcceptedConnection(bob, viewer),
    ];
    profiles = new Map<string, Profile>([
      [alice.value, makeProfile(alice, 'Alice F')],
      [bob.value, makeProfile(bob, 'Bob F')],
      [viewer.value, makeProfile(viewer, 'Viewer V')],
    ]);
  });

  it('should populate followerName for every accepted follower connection', async () => {
    // Arrange
    const handler = new GetFollowersHandler(
      new StubConnectionRepo(connections) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act
    const result = await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(result.items.map((c) => c.followerName)).toEqual(['Alice F', 'Bob F']);
  });

  it('should leave followerName undefined when a follower has no Profile row', async () => {
    // Arrange — Bob has no profile
    profiles.delete(bob.value);
    const handler = new GetFollowersHandler(
      new StubConnectionRepo(connections) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act
    const result = await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(result.items[1]!.followerName).toBeUndefined();
  });

  it('should populate followeeName so callers can render either perspective', async () => {
    // Arrange
    const handler = new GetFollowersHandler(
      new StubConnectionRepo(connections) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act
    const result = await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(result.items.every((c) => c.followeeName === 'Viewer V')).toBe(true);
  });

  it('should issue exactly one batch profile lookup regardless of connection count', async () => {
    // Arrange — twenty connections, three unique members total (viewer + alice + bob)
    const many = Array.from({ length: 10 }, () =>
      makeAcceptedConnection(alice, viewer),
    ).concat(
      Array.from({ length: 10 }, () => makeAcceptedConnection(bob, viewer)),
    );
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFollowersHandler(
      new StubConnectionRepo(many) as never,
      profileRepo as never,
    );

    // Act
    await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(profileRepo.calls).toHaveLength(1);
  });

  it('should deduplicate member ids across both ends of all connections', async () => {
    // Arrange — 20 conns but only 3 unique members
    const many = Array.from({ length: 10 }, () =>
      makeAcceptedConnection(alice, viewer),
    ).concat(
      Array.from({ length: 10 }, () => makeAcceptedConnection(bob, viewer)),
    );
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFollowersHandler(
      new StubConnectionRepo(many) as never,
      profileRepo as never,
    );

    // Act
    await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(profileRepo.calls[0]).toHaveLength(3);
  });

  it('should not call the profile repo when there are zero accepted followers', async () => {
    // Arrange
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFollowersHandler(
      new StubConnectionRepo([]) as never,
      profileRepo as never,
    );

    // Act
    const result = await handler.execute(new GetFollowersQuery(viewer.value));

    // Assert
    expect(profileRepo.calls).toHaveLength(0);
    expect(result.items).toEqual([]);
  });
});
