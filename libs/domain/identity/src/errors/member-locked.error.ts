import { DomainError } from '@csn/domain-shared';

export class MemberLockedError extends DomainError {
  constructor(message: string) {
    super(message, 'MEMBER_LOCKED');
    this.name = 'MemberLockedError';
  }
}
