import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class FollowRejectedEvent extends DomainEvent {
  public readonly followerId: string;
  public readonly followeeId: string;

  constructor(
    aggregateId: string,
    followerId: string,
    followeeId: string,
    version?: number,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, version, metadata);
    this.followerId = followerId;
    this.followeeId = followeeId;
  }

  get eventType(): string {
    return 'FollowRejected';
  }

  get aggregateType(): string {
    return 'Connection';
  }
}
