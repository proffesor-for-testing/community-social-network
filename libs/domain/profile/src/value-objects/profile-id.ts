import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface ProfileIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProfileId extends ValueObject<ProfileIdProps> {
  private constructor(props: ProfileIdProps) {
    super(props);
  }

  public static create(value: string): ProfileId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('ProfileId must be a valid UUID');
    }
    return new ProfileId({ value });
  }

  public static generate(): ProfileId {
    return new ProfileId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
