import { DomainError } from '@csn/domain-shared';

export class OnlyOwnerCanTransferError extends DomainError {
  constructor() {
    super(
      'Only the group owner can transfer ownership.',
      'ONLY_OWNER_CAN_TRANSFER',
    );
    this.name = 'OnlyOwnerCanTransferError';
  }
}
