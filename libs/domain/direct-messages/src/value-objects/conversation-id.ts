import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface ConversationIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ConversationId extends ValueObject<ConversationIdProps> {
  private constructor(props: ConversationIdProps) {
    super(props);
  }

  public static create(value: string): ConversationId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('ConversationId must be a valid UUID');
    }
    return new ConversationId({ value });
  }

  public static generate(): ConversationId {
    return new ConversationId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
