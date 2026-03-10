import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class PreferencesUpdatedEvent extends DomainEvent {
  public readonly channels: string[];

  constructor(
    aggregateId: string,
    channels: string[],
    version: number = 1,
    metadata: EventMetadata = {},
  ) {
    super(aggregateId, version, metadata);
    this.channels = [...channels];
  }

  get eventType(): string {
    return 'PreferencesUpdated';
  }

  get aggregateType(): string {
    return 'Preference';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      channels: [...this.channels],
    };
  }
}
