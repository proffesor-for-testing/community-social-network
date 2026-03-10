import { ValueObject, ValidationError } from '@csn/domain-shared';

interface AlertContentProps {
  title: string;
  body: string;
  actionUrl?: string;
}

export class AlertContent extends ValueObject<AlertContentProps> {
  private constructor(props: AlertContentProps) {
    super(props);
  }

  public static create(title: string, body: string, actionUrl?: string): AlertContent {
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Alert title must not be empty');
    }
    if (!body || body.trim().length === 0) {
      throw new ValidationError('Alert body must not be empty');
    }
    if (actionUrl !== undefined && actionUrl.trim().length === 0) {
      throw new ValidationError('Alert actionUrl must not be empty when provided');
    }
    return new AlertContent({ title: title.trim(), body: body.trim(), actionUrl: actionUrl?.trim() });
  }

  public get title(): string {
    return this.props.title;
  }

  public get body(): string {
    return this.props.body;
  }

  public get actionUrl(): string | undefined {
    return this.props.actionUrl;
  }
}
