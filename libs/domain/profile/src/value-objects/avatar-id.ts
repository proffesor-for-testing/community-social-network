import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface AvatarIdProps {
  value: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AvatarId extends ValueObject<AvatarIdProps> {
  private constructor(props: AvatarIdProps) {
    super(props);
  }

  public static create(value: string): AvatarId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('AvatarId must be a valid UUID');
    }
    return new AvatarId({ value });
  }

  public static generate(): AvatarId {
    return new AvatarId({ value: randomUUID() });
  }

  public static none(): AvatarId {
    return new AvatarId({ value: null });
  }

  public get value(): string | null {
    return this.props.value;
  }

  public get hasValue(): boolean {
    return this.props.value !== null;
  }

  public toString(): string {
    return this.props.value ?? '';
  }
}
