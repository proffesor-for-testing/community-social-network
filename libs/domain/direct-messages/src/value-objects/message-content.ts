import { ValueObject, ValidationError } from '@csn/domain-shared';

interface MessageContentProps {
  value: string;
}

export const MESSAGE_CONTENT_MIN_LENGTH = 1;
export const MESSAGE_CONTENT_MAX_LENGTH = 2000;

/**
 * The body of a direct message. Trimmed on the way in, so a message made of
 * whitespace alone is rejected rather than persisted as a blank bubble.
 */
export class MessageContent extends ValueObject<MessageContentProps> {
  private constructor(props: MessageContentProps) {
    super(props);
  }

  public static create(value: string): MessageContent {
    const trimmed = typeof value === 'string' ? value.trim() : '';

    if (trimmed.length < MESSAGE_CONTENT_MIN_LENGTH) {
      throw new ValidationError('Message content must not be empty');
    }
    if (trimmed.length > MESSAGE_CONTENT_MAX_LENGTH) {
      throw new ValidationError(
        `Message content must not exceed ${MESSAGE_CONTENT_MAX_LENGTH} characters`,
      );
    }

    return new MessageContent({ value: trimmed });
  }

  public get value(): string {
    return this.props.value;
  }

  public get length(): number {
    return this.props.value.length;
  }

  public toString(): string {
    return this.props.value;
  }
}
