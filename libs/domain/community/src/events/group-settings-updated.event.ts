import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class GroupSettingsUpdatedEvent extends DomainEvent {
  public readonly changes: string[];

  constructor(
    aggregateId: string,
    props: { changes: string[] },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.changes = [...props.changes];
  }

  get eventType(): string {
    return 'GroupSettingsUpdated';
  }

  get aggregateType(): string {
    return 'Group';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      changes: [...this.changes],
    };
  }
}
