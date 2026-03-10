import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface MemberIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MemberId extends ValueObject<MemberIdProps> {
  private constructor(props: MemberIdProps) {
    super(props);
  }

  public static create(value: string): MemberId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('MemberId must be a valid UUID');
    }
    return new MemberId({ value });
  }

  public static generate(): MemberId {
    return new MemberId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
