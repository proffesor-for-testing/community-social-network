import { ValueObject, ValidationError } from '@csn/domain-shared';

export enum DiscussionStatusEnum {
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

interface DiscussionStatusProps {
  value: DiscussionStatusEnum;
}

export class DiscussionStatus extends ValueObject<DiscussionStatusProps> {
  private constructor(props: DiscussionStatusProps) {
    super(props);
  }

  public static create(value: string): DiscussionStatus {
    if (!Object.values(DiscussionStatusEnum).includes(value as DiscussionStatusEnum)) {
      throw new ValidationError(
        `Invalid discussion status: ${value}. Must be one of: ${Object.values(DiscussionStatusEnum).join(', ')}`,
      );
    }
    return new DiscussionStatus({ value: value as DiscussionStatusEnum });
  }

  public static get ACTIVE(): DiscussionStatus {
    return new DiscussionStatus({ value: DiscussionStatusEnum.ACTIVE });
  }

  public static get HIDDEN(): DiscussionStatus {
    return new DiscussionStatus({ value: DiscussionStatusEnum.HIDDEN });
  }

  public static get DELETED(): DiscussionStatus {
    return new DiscussionStatus({ value: DiscussionStatusEnum.DELETED });
  }

  public get value(): DiscussionStatusEnum {
    return this.props.value;
  }

  public isActive(): boolean {
    return this.props.value === DiscussionStatusEnum.ACTIVE;
  }

  public isDeleted(): boolean {
    return this.props.value === DiscussionStatusEnum.DELETED;
  }

  public toString(): string {
    return this.props.value;
  }
}
