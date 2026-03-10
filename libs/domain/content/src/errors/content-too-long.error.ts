import { DomainError } from '@csn/domain-shared';

export class ContentTooLongError extends DomainError {
  constructor(actual: number, max: number) {
    super(
      `Content length ${actual} exceeds maximum of ${max} characters`,
      'CONTENT_TOO_LONG',
    );
    this.name = 'ContentTooLongError';
  }
}
