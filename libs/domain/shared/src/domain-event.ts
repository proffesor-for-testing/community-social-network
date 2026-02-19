import { randomUUID } from 'crypto';

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
}

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly aggregateId: string;
  public readonly version: number;
  public readonly metadata: EventMetadata;

  constructor(
    aggregateId: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.version = version;
    this.metadata = Object.freeze({ ...metadata });
    Object.freeze(this);
  }

  abstract get eventType(): string;
}
