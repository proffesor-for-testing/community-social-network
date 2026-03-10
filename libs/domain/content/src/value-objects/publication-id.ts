import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface PublicationIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PublicationId extends ValueObject<PublicationIdProps> {
  private constructor(props: PublicationIdProps) {
    super(props);
  }

  public static create(value: string): PublicationId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('PublicationId must be a valid UUID');
    }
    return new PublicationId({ value });
  }

  public static generate(): PublicationId {
    return new PublicationId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
