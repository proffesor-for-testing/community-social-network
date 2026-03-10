import { ValueObject, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';

interface BioProps {
  value: string;
}

export class Bio extends ValueObject<BioProps> {
  private constructor(props: BioProps) {
    super(props);
  }

  public static create(value: string): Bio {
    if (value === null || value === undefined) {
      throw new ValidationError('Bio cannot be null or undefined');
    }

    if (value.length > CONTENT_LIMITS.MAX_BIO_LENGTH) {
      throw new ValidationError(
        `Bio must not exceed ${CONTENT_LIMITS.MAX_BIO_LENGTH} characters`,
      );
    }

    return new Bio({ value });
  }

  public static empty(): Bio {
    return new Bio({ value: '' });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
