import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberJoinedGroupEvent extends DomainEvent {
  public readonly memberId: string;
  public readonly role: string;

  constructor(
    aggregateId: string,
    props: { memberId: string; role: string },
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.memberId = props.memberId;
    this.role = props.role;
  }

  get eventType(): string {
    return 'MemberJoinedGroup';
  }

  get aggregateType(): string {
    return 'Membership';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      memberId: this.memberId,
      role: this.role,
    };
  }
}
