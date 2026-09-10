import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class ConversationStartedEvent extends DomainEvent {
  public readonly participantA: string;
  public readonly participantB: string;

  constructor(
    aggregateId: string,
    participantA: string,
    participantB: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.participantA = participantA;
    this.participantB = participantB;
  }

  get eventType(): string {
    return 'ConversationStarted';
  }

  get aggregateType(): string {
    return 'Conversation';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      participantA: this.participantA,
      participantB: this.participantB,
    };
  }
}
