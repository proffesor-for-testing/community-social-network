import { DomainEvent } from '@csn/domain-shared';

export class MemberRegisteredEvent extends DomainEvent {
  public readonly email: string;
  public readonly displayName: string;

  constructor(aggregateId: string, email: string, displayName: string) {
    super(aggregateId);
    this.email = email;
    this.displayName = displayName;
  }

  get eventType(): string {
    return 'MemberRegistered';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
