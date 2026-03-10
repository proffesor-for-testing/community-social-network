import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class PublicationEditedEvent extends DomainEvent {
  public readonly editedFields: string[];

  constructor(
    aggregateId: string,
    editedFields: string[],
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.editedFields = editedFields;
  }

  get eventType(): string {
    return 'PublicationEdited';
  }

  get aggregateType(): string {
    return 'Publication';
  }
}
