import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class PublicationDeletedEvent extends DomainEvent {
  constructor(aggregateId: string, metadata?: EventMetadata) {
    super(aggregateId, 1, metadata);
  }

  get eventType(): string {
    return 'PublicationDeleted';
  }

  get aggregateType(): string {
    return 'Publication';
  }
}
