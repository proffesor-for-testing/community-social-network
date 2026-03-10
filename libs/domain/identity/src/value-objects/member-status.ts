import { ValueObject, ValidationError } from '@csn/domain-shared';

interface MemberStatusProps {
  value: string;
}

const VALID_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'DEACTIVATED',
] as const;

type MemberStatusValue = (typeof VALID_STATUSES)[number];

/**
 * Valid state transitions:
 *   PENDING_VERIFICATION -> ACTIVE
 *   ACTIVE -> SUSPENDED, LOCKED, DEACTIVATED
 *   SUSPENDED -> ACTIVE, DEACTIVATED
 *   LOCKED -> ACTIVE
 *   DEACTIVATED -> (terminal, no transitions)
 */
const VALID_TRANSITIONS: Record<MemberStatusValue, MemberStatusValue[]> = {
  PENDING_VERIFICATION: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'LOCKED', 'DEACTIVATED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  LOCKED: ['ACTIVE'],
  DEACTIVATED: [],
};

export class MemberStatus extends ValueObject<MemberStatusProps> {
  private constructor(props: MemberStatusProps) {
    super(props);
  }

  public static create(value: string): MemberStatus {
    if (!value || !VALID_STATUSES.includes(value as MemberStatusValue)) {
      throw new ValidationError(
        `Invalid member status: '${value}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }
    return new MemberStatus({ value });
  }

  public static pendingVerification(): MemberStatus {
    return new MemberStatus({ value: 'PENDING_VERIFICATION' });
  }

  public static active(): MemberStatus {
    return new MemberStatus({ value: 'ACTIVE' });
  }

  public static suspended(): MemberStatus {
    return new MemberStatus({ value: 'SUSPENDED' });
  }

  public static locked(): MemberStatus {
    return new MemberStatus({ value: 'LOCKED' });
  }

  public static deactivated(): MemberStatus {
    return new MemberStatus({ value: 'DEACTIVATED' });
  }

  public get value(): string {
    return this.props.value;
  }

  public canTransitionTo(target: MemberStatus): boolean {
    const allowed = VALID_TRANSITIONS[this.props.value as MemberStatusValue];
    if (!allowed) {
      return false;
    }
    return allowed.includes(target.props.value as MemberStatusValue);
  }
}
