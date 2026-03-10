import { ValueObject, ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';

interface MentionProps {
  userId: string;
  position: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Mention extends ValueObject<MentionProps> {
  private constructor(props: MentionProps) {
    super(props);
  }

  public static create(userId: string, position: number): Mention {
    if (!userId || !UUID_REGEX.test(userId)) {
      throw new ValidationError('Mention userId must be a valid UUID');
    }
    if (position < 0 || !Number.isInteger(position)) {
      throw new ValidationError('Mention position must be a non-negative integer');
    }
    return new Mention({ userId, position });
  }

  public static validateCount(count: number): void {
    if (count > CONTENT_LIMITS.MAX_MENTIONS_PER_CONTENT) {
      throw new ValidationError(
        `Cannot exceed ${CONTENT_LIMITS.MAX_MENTIONS_PER_CONTENT} mentions per content`,
      );
    }
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get position(): number {
    return this.props.position;
  }
}
