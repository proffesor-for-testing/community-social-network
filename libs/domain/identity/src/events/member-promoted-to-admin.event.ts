import { DomainEvent } from '@csn/domain-shared';

export class MemberPromotedToAdminEvent extends DomainEvent {
  public readonly promotedBy: string;

  constructor(aggregateId: string, promotedBy: string) {
    super(aggregateId);
    this.promotedBy = promotedBy;
  }

  get eventType(): string {
    return 'MemberPromotedToAdmin';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
