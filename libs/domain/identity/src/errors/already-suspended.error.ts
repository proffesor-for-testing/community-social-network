import { DomainError } from '@csn/domain-shared';

export class AlreadySuspendedError extends DomainError {
  constructor(message: string) {
    super(message, 'ALREADY_SUSPENDED');
    this.name = 'AlreadySuspendedError';
  }
}
