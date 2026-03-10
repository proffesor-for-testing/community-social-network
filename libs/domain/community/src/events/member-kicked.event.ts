import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberKickedEvent extends DomainEvent {
  public readonly memberId: string;
  public readonly kickedBy: string;
  public readonly reason: string;

  constructor(
    aggregateId: string,
    props: { memberId: string; kickedBy: string; reason: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.memberId = props.memberId;
    this.kickedBy = props.kickedBy;
    this.reason = props.reason;
  }

  get eventType(): string {
    return 'MemberKicked';
  }

  get aggregateType(): string {
    return 'Membership';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      memberId: this.memberId,
      kickedBy: this.kickedBy,
      reason: this.reason,
    };
  }
}
