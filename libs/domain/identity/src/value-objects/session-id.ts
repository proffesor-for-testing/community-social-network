import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface SessionIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SessionId extends ValueObject<SessionIdProps> {
  private constructor(props: SessionIdProps) {
    super(props);
  }

  public static create(value: string): SessionId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('SessionId must be a valid UUID');
    }
    return new SessionId({ value });
  }

  public static generate(): SessionId {
    return new SessionId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
