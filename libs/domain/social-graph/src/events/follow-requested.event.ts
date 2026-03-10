import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class FollowRequestedEvent extends DomainEvent {
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
    return 'FollowRequested';
  }

  get aggregateType(): string {
    return 'Connection';
  }
}
