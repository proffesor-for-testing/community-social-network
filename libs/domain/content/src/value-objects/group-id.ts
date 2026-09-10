import { randomUUID } from 'crypto';
import { ValueObject, ValidationError } from '@csn/domain-shared';

interface GroupIdProps {
  value: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reference to a Community group from inside the Content context.
 *
 * The Community context owns the Group aggregate; Content only ever holds the
 * identity of a group a publication was posted into. Keeping a local id value
 * object here avoids a domain-to-domain dependency between the two bounded
 * contexts (they only share the identifier's shape, not the aggregate).
 */
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
