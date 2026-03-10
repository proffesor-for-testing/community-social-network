import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class ProfileCreatedEvent extends DomainEvent {
  public readonly displayName: string;
  public readonly email: string;

  constructor(
    aggregateId: string,
    displayName: string,
    email: string,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.displayName = displayName;
    this.email = email;
  }

  get eventType(): string {
    return 'ProfileCreated';
  }

  get aggregateType(): string {
    return 'Profile';
  }
}
