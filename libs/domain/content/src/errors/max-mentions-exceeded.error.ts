import { DomainError, CONTENT_LIMITS } from '@csn/domain-shared';

export class MaxMentionsExceededError extends DomainError {
  constructor() {
    super(
      `Cannot exceed ${CONTENT_LIMITS.MAX_MENTIONS_PER_CONTENT} mentions per content`,
      'MAX_MENTIONS_EXCEEDED',
    );
    this.name = 'MaxMentionsExceededError';
  }
}
