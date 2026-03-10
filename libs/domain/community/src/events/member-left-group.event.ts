import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberLeftGroupEvent extends DomainEvent {
  public readonly memberId: string;

  constructor(
    aggregateId: string,
    props: { memberId: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.memberId = props.memberId;
  }

  get eventType(): string {
    return 'MemberLeftGroup';
  }

  get aggregateType(): string {
    return 'Membership';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      memberId: this.memberId,
    };
  }
}
