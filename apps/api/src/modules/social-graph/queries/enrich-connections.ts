import { Connection } from '@csn/domain-social-graph';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { ConnectionResponseDto } from '../dto/connection-response.dto';

/**
 * Join author display names onto a batch of connections via a single profile
 * round-trip. Returns connections in the same order as the input. Connections
 * whose endpoints have no profile row come back with `followerName` /
 * `followeeName` undefined, so callers can decide how to render the gap.
 */
export async function enrichConnections(
  connections: Connection[],
  profileRepo: IProfileRepository,
): Promise<ConnectionResponseDto[]> {
  if (connections.length === 0) return [];

  const ids = new Set<string>();
  for (const c of connections) {
    ids.add(c.followerId.value);
    ids.add(c.followeeId.value);
  }
  const byMemberId = await profileRepo.findByMemberIds(
    Array.from(ids).map((id) => UserId.create(id)),
  );

  return connections.map((c) => {
    const followerProfile = byMemberId.get(c.followerId.value);
    const followeeProfile = byMemberId.get(c.followeeId.value);
    return ConnectionResponseDto.fromDomain(c, {
      follower: followerProfile
        ? { displayName: followerProfile.displayName.value, avatarUrl: null }
        : undefined,
      followee: followeeProfile
        ? { displayName: followeeProfile.displayName.value, avatarUrl: null }
        : undefined,
    });
  });
}
