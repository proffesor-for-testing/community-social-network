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
  public readonly metadata: Readonly<EventMetadata>;

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
    // NOTE: Do NOT freeze `this` here — subclasses need to set their own properties
    // after calling super(). Immutability is enforced by `readonly` modifiers.
  }

  abstract get eventType(): string;
  abstract get aggregateType(): string;

  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateType: this.aggregateType,
      occurredOn: this.occurredOn.toISOString(),
      aggregateId: this.aggregateId,
      version: this.version,
      metadata: { ...this.metadata },
    };
  }
}
