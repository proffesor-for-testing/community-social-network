import { DomainEvent } from '@csn/domain-shared';

export class MemberAuthenticationSucceededEvent extends DomainEvent {
  public readonly sessionId: string;

  constructor(aggregateId: string, sessionId: string) {
    super(aggregateId);
    this.sessionId = sessionId;
  }

  get eventType(): string {
    return 'MemberAuthenticationSucceeded';
  }

  get aggregateType(): string {
    return 'Member';
  }
}
