import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class GroupCreatedEvent extends DomainEvent {
  public readonly name: string;
  public readonly creatorId: string;

  constructor(
    aggregateId: string,
    props: { name: string; creatorId: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.name = props.name;
    this.creatorId = props.creatorId;
  }

  get eventType(): string {
    return 'GroupCreated';
  }

  get aggregateType(): string {
    return 'Group';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      name: this.name,
      creatorId: this.creatorId,
    };
  }
}
