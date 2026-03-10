import { DomainError } from '@csn/domain-shared';

export class EmptyContentError extends DomainError {
  constructor() {
    super('Content cannot be empty', 'EMPTY_CONTENT');
    this.name = 'EmptyContentError';
  }
}
