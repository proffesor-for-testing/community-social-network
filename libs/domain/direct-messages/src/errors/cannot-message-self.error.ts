import { DomainError } from '@csn/domain-shared';

export class CannotMessageSelfError extends DomainError {
  constructor() {
    super('A user cannot start a conversation with themselves', 'CANNOT_MESSAGE_SELF');
    this.name = 'CannotMessageSelfError';
  }
}
