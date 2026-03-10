import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberMentionedEvent extends DomainEvent {
  public readonly mentionedUserId: string;
  public readonly contentType: string;

  constructor(
    aggregateId: string,
    mentionedUserId: string,
    contentType: string,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.mentionedUserId = mentionedUserId;
    this.contentType = contentType;
  }

  get eventType(): string {
    return 'MemberMentioned';
  }

  get aggregateType(): string {
    return 'Publication';
  }
}
