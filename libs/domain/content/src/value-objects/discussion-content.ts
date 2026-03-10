import { ValueObject, CONTENT_LIMITS } from '@csn/domain-shared';
import { EmptyContentError } from '../errors/empty-content.error';
import { ContentTooLongError } from '../errors/content-too-long.error';

interface DiscussionContentProps {
  text: string;
}

export class DiscussionContent extends ValueObject<DiscussionContentProps> {
  private constructor(props: DiscussionContentProps) {
    super(props);
  }

  public static create(text: string): DiscussionContent {
    if (!text || text.trim().length === 0) {
      throw new EmptyContentError();
    }
    if (text.length > CONTENT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new ContentTooLongError(
        text.length,
        CONTENT_LIMITS.MAX_COMMENT_LENGTH,
      );
    }
    return new DiscussionContent({ text: text.trim() });
  }

  public get text(): string {
    return this.props.text;
  }

  public get length(): number {
    return this.props.text.length;
  }
}
