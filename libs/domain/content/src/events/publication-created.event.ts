import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class PublicationCreatedEvent extends DomainEvent {
  public readonly authorId: string;
  public readonly visibility: string;

  constructor(
    aggregateId: string,
    authorId: string,
    visibility: string,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.authorId = authorId;
    this.visibility = visibility;
  }

  get eventType(): string {
    return 'PublicationCreated';
  }

  get aggregateType(): string {
    return 'Publication';
  }
}
