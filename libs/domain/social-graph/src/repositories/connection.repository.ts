import { IRepository, UserId } from '@csn/domain-shared';
import { Connection } from '../aggregates/connection';
import { ConnectionId } from '../value-objects/connection-id';

export interface IConnectionRepository
  extends IRepository<Connection, ConnectionId> {
  findByFollowerAndFollowee(
    followerId: UserId,
    followeeId: UserId,
  ): Promise<Connection | null>;

  findFollowers(userId: UserId): Promise<Connection[]>;

  findFollowing(userId: UserId): Promise<Connection[]>;

  /**
   * Ids of every member `userId` follows with an ACCEPTED connection.
   *
   * Exists as a dedicated projection because the feed only needs the followee
   * identities: loading full Connection aggregates just to map them would pull
   * the whole following list into memory on every feed page.
   */
  findAcceptedFolloweeIds(userId: UserId): Promise<UserId[]>;

  countFollowers(userId: UserId): Promise<number>;

  countFollowing(userId: UserId): Promise<number>;
}
