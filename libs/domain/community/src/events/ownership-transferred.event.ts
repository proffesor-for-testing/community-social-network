import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class OwnershipTransferredEvent extends DomainEvent {
  public readonly fromOwnerId: string;
  public readonly toOwnerId: string;

  constructor(
    aggregateId: string,
    props: { fromOwnerId: string; toOwnerId: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.fromOwnerId = props.fromOwnerId;
    this.toOwnerId = props.toOwnerId;
  }

  get eventType(): string {
    return 'OwnershipTransferred';
  }

  get aggregateType(): string {
    return 'Group';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      fromOwnerId: this.fromOwnerId,
      toOwnerId: this.toOwnerId,
    };
  }
}
