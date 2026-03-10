import { ValueObject, CONTENT_LIMITS } from '@csn/domain-shared';
import { EmptyContentError } from '../errors/empty-content.error';
import { ContentTooLongError } from '../errors/content-too-long.error';

interface PublicationContentProps {
  text: string;
}

export class PublicationContent extends ValueObject<PublicationContentProps> {
  private constructor(props: PublicationContentProps) {
    super(props);
  }

  public static create(text: string): PublicationContent {
    if (!text || text.trim().length === 0) {
      throw new EmptyContentError();
    }
    if (text.length > CONTENT_LIMITS.MAX_POST_LENGTH) {
      throw new ContentTooLongError(
        text.length,
        CONTENT_LIMITS.MAX_POST_LENGTH,
      );
    }
    return new PublicationContent({ text: text.trim() });
  }

  public get text(): string {
    return this.props.text;
  }

  public get length(): number {
    return this.props.text.length;
  }
}
