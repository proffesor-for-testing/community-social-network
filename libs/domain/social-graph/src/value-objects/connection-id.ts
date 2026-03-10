import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface ConnectionIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ConnectionId extends ValueObject<ConnectionIdProps> {
  private constructor(props: ConnectionIdProps) {
    super(props);
  }

  public static create(value: string): ConnectionId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('ConnectionId must be a valid UUID');
    }
    return new ConnectionId({ value });
  }

  public static generate(): ConnectionId {
    return new ConnectionId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
