import { ValueObject, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';

interface DisplayNameProps {
  value: string;
}

export class DisplayName extends ValueObject<DisplayNameProps> {
  private constructor(props: DisplayNameProps) {
    super(props);
  }

  public static create(value: string): DisplayName {
    if (value === null || value === undefined) {
      throw new ValidationError('Display name cannot be null or undefined');
    }

    const trimmed = value.trim();

    if (trimmed.length < CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH) {
      throw new ValidationError(
        `Display name must be at least ${CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH} characters`,
      );
    }

    if (trimmed.length > CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH) {
      throw new ValidationError(
        `Display name must not exceed ${CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH} characters`,
      );
    }

    return new DisplayName({ value: trimmed });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
