import { randomUUID } from 'crypto';
import { ValueObject } from '../value-object';
import { ValidationError } from '../errors/domain-error';

interface UserIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserId extends ValueObject<UserIdProps> {
  private constructor(props: UserIdProps) {
    super(props);
  }

  public static create(value: string): UserId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('UserId must be a valid UUID');
    }
    return new UserId({ value });
  }

  public static generate(): UserId {
    return new UserId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
