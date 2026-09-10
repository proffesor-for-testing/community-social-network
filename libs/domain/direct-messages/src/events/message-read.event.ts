import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MessageReadEvent extends DomainEvent {
  public readonly conversationId: string;
  public readonly readerId: string;

  constructor(
    aggregateId: string,
    conversationId: string,
    readerId: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.conversationId = conversationId;
    this.readerId = readerId;
  }

  get eventType(): string {
    return 'MessageRead';
  }

  get aggregateType(): string {
    return 'Message';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      conversationId: this.conversationId,
      readerId: this.readerId,
    };
  }
}
