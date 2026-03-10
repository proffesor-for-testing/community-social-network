import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class ProfileUpdatedEvent extends DomainEvent {
  public readonly changes: string[];

  constructor(
    aggregateId: string,
    changes: string[],
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.changes = [...changes];
  }

  get eventType(): string {
    return 'ProfileUpdated';
  }

  get aggregateType(): string {
    return 'Profile';
  }
}
