import { DomainError } from '@csn/domain-shared';

export class CannotPromoteToOwnerError extends DomainError {
  constructor() {
    super(
      'Cannot promote a member to OWNER role. Use ownership transfer instead.',
      'CANNOT_PROMOTE_TO_OWNER',
    );
    this.name = 'CannotPromoteToOwnerError';
  }
}
