import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class DiscussionCreatedEvent extends DomainEvent {
  public readonly authorId: string;
  public readonly publicationId: string;
  public readonly parentId: string | null;

  constructor(
    aggregateId: string,
    authorId: string,
    publicationId: string,
    parentId: string | null,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.authorId = authorId;
    this.publicationId = publicationId;
    this.parentId = parentId;
  }

  get eventType(): string {
    return 'DiscussionCreated';
  }

  get aggregateType(): string {
    return 'Discussion';
  }
}
