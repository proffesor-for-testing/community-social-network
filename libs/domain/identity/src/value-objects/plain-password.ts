import { ValueObject, ValidationError, SECURITY_LIMITS } from '@csn/domain-shared';

interface PlainPasswordProps {
  value: string;
}

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const DIGIT_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

export class PlainPassword extends ValueObject<PlainPasswordProps> {
  private constructor(props: PlainPasswordProps) {
    super(props);
  }

  public static create(value: string): PlainPassword {
    if (!value) {
      throw new ValidationError('Password cannot be empty');
    }

    if (value.length < SECURITY_LIMITS.PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${SECURITY_LIMITS.PASSWORD_MIN_LENGTH} characters long`,
      );
    }

    if (!UPPERCASE_REGEX.test(value)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter',
      );
    }

    if (!LOWERCASE_REGEX.test(value)) {
      throw new ValidationError(
        'Password must contain at least one lowercase letter',
      );
    }

    if (!DIGIT_REGEX.test(value)) {
      throw new ValidationError(
        'Password must contain at least one digit',
      );
    }

    if (!SPECIAL_CHAR_REGEX.test(value)) {
      throw new ValidationError(
        'Password must contain at least one special character',
      );
    }

    return new PlainPassword({ value });
  }

  public get value(): string {
    return this.props.value;
  }
}
