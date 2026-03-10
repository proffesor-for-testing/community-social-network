import { ValueObject, ValidationError } from '@csn/domain-shared';

interface GroupRuleProps {
  title: string;
  description: string;
}

const MAX_RULE_TITLE_LENGTH = 100;

export class GroupRule extends ValueObject<GroupRuleProps> {
  private constructor(props: GroupRuleProps) {
    super(props);
  }

  public static create(title: string, description: string): GroupRule {
    const trimmedTitle = title?.trim() ?? '';
    const trimmedDescription = description?.trim() ?? '';

    if (!trimmedTitle) {
      throw new ValidationError('Group rule title cannot be empty');
    }

    if (trimmedTitle.length > MAX_RULE_TITLE_LENGTH) {
      throw new ValidationError(
        `Group rule title cannot exceed ${MAX_RULE_TITLE_LENGTH} characters`,
      );
    }

    return new GroupRule({
      title: trimmedTitle,
      description: trimmedDescription,
    });
  }

  public get title(): string {
    return this.props.title;
  }

  public get description(): string {
    return this.props.description;
  }
}
