import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface AuditEntryIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AuditEntryId extends ValueObject<AuditEntryIdProps> {
  private constructor(props: AuditEntryIdProps) {
    super(props);
  }

  public static create(value: string): AuditEntryId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('AuditEntryId must be a valid UUID');
    }
    return new AuditEntryId({ value });
  }

  public static generate(): AuditEntryId {
    return new AuditEntryId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
