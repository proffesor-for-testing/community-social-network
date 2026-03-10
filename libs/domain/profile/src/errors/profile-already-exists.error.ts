import { DomainError } from '@csn/domain-shared';

export class ProfileAlreadyExistsError extends DomainError {
  constructor(identifier: string) {
    super(`Profile already exists: ${identifier}`, 'PROFILE_ALREADY_EXISTS');
    this.name = 'ProfileAlreadyExistsError';
  }
}
