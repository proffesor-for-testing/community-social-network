import { DomainError } from '@csn/domain-shared';

export enum AlertStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  DISMISSED = 'DISMISSED',
}

const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  [AlertStatus.UNREAD]: [AlertStatus.READ, AlertStatus.DISMISSED],
  [AlertStatus.READ]: [AlertStatus.DISMISSED],
  [AlertStatus.DISMISSED]: [],
};

export function assertAlertStatusTransition(from: AlertStatus, to: AlertStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new DomainError(
      `Invalid alert status transition from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
    );
  }
}
