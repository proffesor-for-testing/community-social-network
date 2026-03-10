import { DomainError } from '@csn/domain-shared';

export class ProfileNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Profile not found: ${identifier}`, 'PROFILE_NOT_FOUND');
    this.name = 'ProfileNotFoundError';
  }
}
