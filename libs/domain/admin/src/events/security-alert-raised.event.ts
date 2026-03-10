import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class SecurityAlertRaisedEvent extends DomainEvent {
  public readonly severity: string;
  public readonly description: string;

  constructor(
    aggregateId: string,
    severity: string,
    description: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.severity = severity;
    this.description = description;
  }

  get eventType(): string {
    return 'SecurityAlertRaised';
  }

  get aggregateType(): string {
    return 'AuditEntry';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      severity: this.severity,
      description: this.description,
    };
  }
}
