import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface GroupIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GroupId extends ValueObject<GroupIdProps> {
  private constructor(props: GroupIdProps) {
    super(props);
  }

  public static create(value: string): GroupId {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError('GroupId must be a valid UUID');
    }
    return new GroupId({ value });
  }

  public static generate(): GroupId {
    return new GroupId({ value: randomUUID() });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
