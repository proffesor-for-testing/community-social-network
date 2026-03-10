import { ValueObject, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';

interface GroupNameProps {
  value: string;
}

export class GroupName extends ValueObject<GroupNameProps> {
  private constructor(props: GroupNameProps) {
    super(props);
  }

  public static create(value: string): GroupName {
    const trimmed = value?.trim() ?? '';

    if (!trimmed) {
      throw new ValidationError('Group name cannot be empty');
    }

    if (trimmed.length > CONTENT_LIMITS.MAX_GROUP_NAME_LENGTH) {
      throw new ValidationError(
        `Group name cannot exceed ${CONTENT_LIMITS.MAX_GROUP_NAME_LENGTH} characters`,
      );
    }

    return new GroupName({ value: trimmed });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
