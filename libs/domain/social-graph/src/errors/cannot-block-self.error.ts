import { DomainError } from '@csn/domain-shared';

export class CannotBlockSelfError extends DomainError {
  constructor() {
    super('A user cannot block themselves', 'CANNOT_BLOCK_SELF');
    this.name = 'CannotBlockSelfError';
  }
}
