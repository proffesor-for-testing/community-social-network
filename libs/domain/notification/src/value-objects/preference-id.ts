import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface PreferenceIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PreferenceId extends ValueObject<PreferenceIdProps> {
  private constructor(props: PreferenceIdProps) {
    super(props);
  }

  public static create(value: string): PreferenceId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('PreferenceId must be a valid UUID');
    }
    return new PreferenceId({ value });
  }

  public static generate(): PreferenceId {
    return new PreferenceId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
