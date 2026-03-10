import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class AuditEntryCreatedEvent extends DomainEvent {
  public readonly action: string;
  public readonly performedBy: string;
  public readonly targetId: string;

  constructor(
    aggregateId: string,
    action: string,
    performedBy: string,
    targetId: string,
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.action = action;
    this.performedBy = performedBy;
    this.targetId = targetId;
  }

  get eventType(): string {
    return 'AuditEntryCreated';
  }

  get aggregateType(): string {
    return 'AuditEntry';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      action: this.action,
      performedBy: this.performedBy,
      targetId: this.targetId,
    };
  }
}
