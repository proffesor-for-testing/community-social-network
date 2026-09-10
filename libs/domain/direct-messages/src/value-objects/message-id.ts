import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface MessageIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MessageId extends ValueObject<MessageIdProps> {
  private constructor(props: MessageIdProps) {
    super(props);
  }

  public static create(value: string): MessageId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('MessageId must be a valid UUID');
    }
    return new MessageId({ value });
  }

  public static generate(): MessageId {
    return new MessageId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
