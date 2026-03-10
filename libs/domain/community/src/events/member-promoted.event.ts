import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberPromotedEvent extends DomainEvent {
  public readonly memberId: string;
  public readonly fromRole: string;
  public readonly toRole: string;

  constructor(
    aggregateId: string,
    props: { memberId: string; fromRole: string; toRole: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.memberId = props.memberId;
    this.fromRole = props.fromRole;
    this.toRole = props.toRole;
  }

  get eventType(): string {
    return 'MemberPromoted';
  }

  get aggregateType(): string {
    return 'Membership';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      memberId: this.memberId,
      fromRole: this.fromRole,
      toRole: this.toRole,
    };
  }
}
