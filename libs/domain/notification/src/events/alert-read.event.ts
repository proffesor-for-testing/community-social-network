import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class AlertReadEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
  }

  get eventType(): string {
    return 'AlertRead';
  }

  get aggregateType(): string {
    return 'Alert';
  }
}
