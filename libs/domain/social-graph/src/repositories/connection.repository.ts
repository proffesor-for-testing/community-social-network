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

  countFollowers(userId: UserId): Promise<number>;

  countFollowing(userId: UserId): Promise<number>;
}
