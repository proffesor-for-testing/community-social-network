import { DomainEvent } from '@csn/domain-shared';

export class MemberSuspendedEvent extends DomainEvent {
  public readonly reason: string;
  public readonly suspendedBy: string;

  constructor(aggregateId: string, reason: string, suspendedBy: string) {
    super(aggregateId);
    this.reason = reason;
    this.suspendedBy = suspendedBy;
  }

  get eventType(): string {
    return 'MemberSuspended';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
