import { ValueObject } from '../value-object';
import { ValidationError } from '../errors/domain-error';

interface EmailProps {
  value: string;
}

const MAX_EMAIL_LENGTH = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(value: string): Email {
    if (!value) {
      throw new ValidationError('Email cannot be empty');
    }

    const normalized = value.trim().toLowerCase();

    if (normalized.length > MAX_EMAIL_LENGTH) {
      throw new ValidationError(
        `Email must not exceed ${MAX_EMAIL_LENGTH} characters`,
      );
    }

    if (!EMAIL_REGEX.test(normalized)) {
      throw new ValidationError('Email format is invalid');
    }

    return new Email({ value: normalized });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
