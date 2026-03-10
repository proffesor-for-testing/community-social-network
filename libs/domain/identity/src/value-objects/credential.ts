import { ValueObject, ValidationError } from '@csn/domain-shared';

interface CredentialProps {
  hash: string;
}

export class Credential extends ValueObject<CredentialProps> {
  private constructor(props: CredentialProps) {
    super(props);
  }

  public static create(hash: string): Credential {
    if (!hash || hash.trim().length === 0) {
      throw new ValidationError('Credential hash cannot be empty');
    }
    return new Credential({ hash });
  }

  public get value(): string {
    return this.props.hash;
  }
}
