import { ValueObject, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';

interface GroupDescriptionProps {
  value: string;
}

export class GroupDescription extends ValueObject<GroupDescriptionProps> {
  private constructor(props: GroupDescriptionProps) {
    super(props);
  }

  public static create(value: string): GroupDescription {
    const trimmed = value?.trim() ?? '';

    if (trimmed.length > CONTENT_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Group description cannot exceed ${CONTENT_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH} characters`,
      );
    }

    return new GroupDescription({ value: trimmed });
  }

  public static empty(): GroupDescription {
    return new GroupDescription({ value: '' });
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
