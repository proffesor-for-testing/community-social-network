import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface BlockIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BlockId extends ValueObject<BlockIdProps> {
  private constructor(props: BlockIdProps) {
    super(props);
  }

  public static create(value: string): BlockId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('BlockId must be a valid UUID');
    }
    return new BlockId({ value });
  }

  public static generate(): BlockId {
    return new BlockId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
