import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MessageSentEvent extends DomainEvent {
  public readonly conversationId: string;
  public readonly senderId: string;
  public readonly recipientId: string;

  constructor(
    aggregateId: string,
    conversationId: string,
    senderId: string,
    recipientId: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.conversationId = conversationId;
    this.senderId = senderId;
    this.recipientId = recipientId;
  }

  get eventType(): string {
    return 'MessageSent';
  }

  get aggregateType(): string {
    return 'Message';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      conversationId: this.conversationId,
      senderId: this.senderId,
      recipientId: this.recipientId,
    };
  }
}
