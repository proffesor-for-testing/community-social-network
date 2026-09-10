import { DomainEvent } from '@csn/domain-shared';

export class MemberDemotedFromAdminEvent extends DomainEvent {
  public readonly demotedBy: string;

  constructor(aggregateId: string, demotedBy: string) {
    super(aggregateId);
    this.demotedBy = demotedBy;
  }

  get eventType(): string {
    return 'MemberDemotedFromAdmin';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
