import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Email } from '@csn/domain-shared';
import { Connection, ConnectionId } from '@csn/domain-social-graph';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { enrichConnections } from '../queries/enrich-connections';

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
  async findByMemberId() {
    throw new Error('not used here');
  }
}

describe('enrichConnections', () => {
  let viewer: UserId;
  let alice: UserId;
  let profiles: Map<string, Profile>;

  beforeEach(() => {
    // Arrange
    viewer = UserId.generate();
    alice = UserId.generate();
    profiles = new Map<string, Profile>([
      [alice.value, makeProfile(alice, 'Alice E')],
      [viewer.value, makeProfile(viewer, 'Viewer V')],
    ]);
  });

  it('should return an empty array without touching the profile repo when no connections are given', async () => {
    // Arrange
    const repo = new StubProfileRepo(profiles);

    // Act
    const out = await enrichConnections([], repo as never);

    // Assert
    expect(out).toEqual([]);
    expect(repo.calls).toHaveLength(0);
  });

  it('should preserve input order in the output', async () => {
    // Arrange
    const a = makeAcceptedConnection(alice, viewer);
    const b = makeAcceptedConnection(viewer, alice);
    const repo = new StubProfileRepo(profiles);

    // Act
    const out = await enrichConnections([a, b], repo as never);

    // Assert
    expect(out.map((c) => c.id)).toEqual([a.id.value, b.id.value]);
  });

  it('should leave the name undefined when one side has no profile row', async () => {
    // Arrange — alice has no profile entry
    profiles.delete(alice.value);
    const c = makeAcceptedConnection(alice, viewer);
    const repo = new StubProfileRepo(profiles);

    // Act
    const out = await enrichConnections([c], repo as never);

    // Assert
    expect(out[0]!.followerName).toBeUndefined();
  });

  it('should still resolve the other side when only one profile is missing', async () => {
    // Arrange
    profiles.delete(alice.value);
    const c = makeAcceptedConnection(alice, viewer);
    const repo = new StubProfileRepo(profiles);

    // Act
    const out = await enrichConnections([c], repo as never);

    // Assert
    expect(out[0]!.followeeName).toBe('Viewer V');
  });
});
