import { DomainEvent } from '@csn/domain-shared';

export class MemberLockedEvent extends DomainEvent {
  public readonly reason: string;
  public readonly failedAttempts: number;

  constructor(aggregateId: string, reason: string, failedAttempts: number) {
    super(aggregateId);
    this.reason = reason;
    this.failedAttempts = failedAttempts;
  }

  get eventType(): string {
    return 'MemberLocked';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
