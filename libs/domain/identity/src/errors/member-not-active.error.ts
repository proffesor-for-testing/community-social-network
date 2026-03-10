import { DomainError } from '@csn/domain-shared';

export class MemberNotActiveError extends DomainError {
  constructor(message: string) {
    super(message, 'MEMBER_NOT_ACTIVE');
    this.name = 'MemberNotActiveError';
  }
}
