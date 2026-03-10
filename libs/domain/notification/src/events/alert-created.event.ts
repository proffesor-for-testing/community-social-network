import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class AlertCreatedEvent extends DomainEvent {
  public readonly recipientId: string;
  public readonly alertType: string;

  constructor(
    aggregateId: string,
    recipientId: string,
    alertType: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.recipientId = recipientId;
    this.alertType = alertType;
  }

  get eventType(): string {
    return 'AlertCreated';
  }

  get aggregateType(): string {
    return 'Alert';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      recipientId: this.recipientId,
      alertType: this.alertType,
    };
  }
}
