import { DomainError } from '@csn/domain-shared';

export class NotAParticipantError extends DomainError {
  constructor(userId: string) {
    super(
      `User ${userId} is not a participant in this conversation`,
      'NOT_A_PARTICIPANT',
    );
    this.name = 'NotAParticipantError';
  }
}
