import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface AlertIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AlertId extends ValueObject<AlertIdProps> {
  private constructor(props: AlertIdProps) {
    super(props);
  }

  public static create(value: string): AlertId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('AlertId must be a valid UUID');
    }
    return new AlertId({ value });
  }

  public static generate(): AlertId {
    return new AlertId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
