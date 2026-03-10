import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface DiscussionIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DiscussionId extends ValueObject<DiscussionIdProps> {
  private constructor(props: DiscussionIdProps) {
    super(props);
  }

  public static create(value: string): DiscussionId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('DiscussionId must be a valid UUID');
    }
    return new DiscussionId({ value });
  }

  public static generate(): DiscussionId {
    return new DiscussionId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
