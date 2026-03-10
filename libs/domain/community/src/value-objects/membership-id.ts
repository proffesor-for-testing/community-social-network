import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface MembershipIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MembershipId extends ValueObject<MembershipIdProps> {
  private constructor(props: MembershipIdProps) {
    super(props);
  }

  public static create(value: string): MembershipId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('MembershipId must be a valid UUID');
    }
    return new MembershipId({ value });
  }

  public static generate(): MembershipId {
    return new MembershipId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
