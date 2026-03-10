import { DomainError } from '@csn/domain-shared';

export class CannotEditError extends DomainError {
  constructor(reason: string) {
    super(`Cannot edit publication: ${reason}`, 'CANNOT_EDIT');
    this.name = 'CannotEditError';
  }
}
