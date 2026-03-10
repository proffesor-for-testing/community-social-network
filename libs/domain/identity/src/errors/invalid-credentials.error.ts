import { DomainError } from '@csn/domain-shared';

export class InvalidCredentialsError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}
