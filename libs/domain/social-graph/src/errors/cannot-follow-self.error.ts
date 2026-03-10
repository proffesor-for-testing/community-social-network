import { DomainError } from '@csn/domain-shared';

export class CannotFollowSelfError extends DomainError {
  constructor() {
    super('A user cannot follow themselves', 'CANNOT_FOLLOW_SELF');
    this.name = 'CannotFollowSelfError';
  }
}
