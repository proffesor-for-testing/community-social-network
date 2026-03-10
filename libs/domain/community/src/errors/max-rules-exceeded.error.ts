import { DomainError } from '@csn/domain-shared';

export class MaxRulesExceededError extends DomainError {
  constructor(maxRules: number) {
    super(
      `Cannot add more rules. Maximum of ${maxRules} rules allowed.`,
      'MAX_RULES_EXCEEDED',
    );
    this.name = 'MaxRulesExceededError';
  }
}
