import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { ConnectionId } from '../value-objects/connection-id';
import {
  ConnectionStatus,
  ConnectionStatusEnum,
  InvalidStatusTransitionError,
} from '../value-objects/connection-status';
import { CannotFollowSelfError } from '../errors/cannot-follow-self.error';
import { FollowRequestedEvent } from '../events/follow-requested.event';
import { FollowApprovedEvent } from '../events/follow-approved.event';
import { FollowRejectedEvent } from '../events/follow-rejected.event';
import { UnfollowedEvent } from '../events/unfollowed.event';

export class Connection extends AggregateRoot<ConnectionId> {
  private _followerId: UserId;
  private _followeeId: UserId;
  private _status: ConnectionStatus;
  private _createdAt: Timestamp;

  private constructor(
    id: ConnectionId,
    followerId: UserId,
    followeeId: UserId,
    status: ConnectionStatus,
    createdAt: Timestamp,
  ) {
    super(id);
    this._followerId = followerId;
    this._followeeId = followeeId;
    this._status = status;
    this._createdAt = createdAt;
  }

  public static request(
    id: ConnectionId,
    followerId: UserId,
    followeeId: UserId,
  ): Connection {
    if (followerId.equals(followeeId)) {
      throw new CannotFollowSelfError();
    }

    const connection = new Connection(
      id,
      followerId,
      followeeId,
      ConnectionStatus.pending(),
      Timestamp.now(),
    );

    connection.addDomainEvent(
      new FollowRequestedEvent(
        id.value,
        followerId.value,
        followeeId.value,
      ),
    );

    return connection;
  }

  /**
   * Reconstitute a Connection from persistence without emitting events.
   */
  public static reconstitute(
    id: ConnectionId,
    followerId: UserId,
    followeeId: UserId,
    status: ConnectionStatus,
    createdAt: Timestamp,
    version: number,
  ): Connection {
    const connection = new Connection(id, followerId, followeeId, status, createdAt);
    connection.setVersion(version);
    return connection;
  }

  public approve(): void {
    if (!this._status.canTransitionTo(ConnectionStatusEnum.ACCEPTED)) {
      throw new InvalidStatusTransitionError(
        this._status.value,
        ConnectionStatusEnum.ACCEPTED,
      );
    }

    this._status = this._status.transitionTo(ConnectionStatusEnum.ACCEPTED);
    this.incrementVersion();

    this.addDomainEvent(
      new FollowApprovedEvent(
        this.id.value,
        this._followerId.value,
        this._followeeId.value,
      ),
    );
  }

  public reject(): void {
    if (!this._status.canTransitionTo(ConnectionStatusEnum.REJECTED)) {
      throw new InvalidStatusTransitionError(
        this._status.value,
        ConnectionStatusEnum.REJECTED,
      );
    }

    this._status = this._status.transitionTo(ConnectionStatusEnum.REJECTED);
    this.incrementVersion();

    this.addDomainEvent(
      new FollowRejectedEvent(
        this.id.value,
        this._followerId.value,
        this._followeeId.value,
      ),
    );
  }

  public unfollow(): void {
    if (this._status.value !== ConnectionStatusEnum.ACCEPTED) {
      throw new InvalidStatusTransitionError(
        this._status.value,
        ConnectionStatusEnum.ACCEPTED, // not a real transition target, but communicates intent
      );
    }

    this.incrementVersion();

    this.addDomainEvent(
      new UnfollowedEvent(
        this.id.value,
        this._followerId.value,
        this._followeeId.value,
      ),
    );
  }

  public get followerId(): UserId {
    return this._followerId;
  }

  public get followeeId(): UserId {
    return this._followeeId;
  }

  public get status(): ConnectionStatus {
    return this._status;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }
}
