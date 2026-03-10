import { ValueObject, ValidationError } from '@csn/domain-shared';

export enum PublicationStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

interface PublicationStatusProps {
  value: PublicationStatusEnum;
}

const ALLOWED_TRANSITIONS: Record<PublicationStatusEnum, PublicationStatusEnum[]> = {
  [PublicationStatusEnum.DRAFT]: [PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DELETED],
  [PublicationStatusEnum.PUBLISHED]: [PublicationStatusEnum.ARCHIVED, PublicationStatusEnum.DELETED],
  [PublicationStatusEnum.ARCHIVED]: [PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DELETED],
  [PublicationStatusEnum.DELETED]: [],
};

export class PublicationStatus extends ValueObject<PublicationStatusProps> {
  private constructor(props: PublicationStatusProps) {
    super(props);
  }

  public static create(value: string): PublicationStatus {
    if (!Object.values(PublicationStatusEnum).includes(value as PublicationStatusEnum)) {
      throw new ValidationError(
        `Invalid publication status: ${value}. Must be one of: ${Object.values(PublicationStatusEnum).join(', ')}`,
      );
    }
    return new PublicationStatus({ value: value as PublicationStatusEnum });
  }

  public static get DRAFT(): PublicationStatus {
    return new PublicationStatus({ value: PublicationStatusEnum.DRAFT });
  }

  public static get PUBLISHED(): PublicationStatus {
    return new PublicationStatus({ value: PublicationStatusEnum.PUBLISHED });
  }

  public static get ARCHIVED(): PublicationStatus {
    return new PublicationStatus({ value: PublicationStatusEnum.ARCHIVED });
  }

  public static get DELETED(): PublicationStatus {
    return new PublicationStatus({ value: PublicationStatusEnum.DELETED });
  }

  public get value(): PublicationStatusEnum {
    return this.props.value;
  }

  public canTransitionTo(target: PublicationStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target.props.value);
  }

  public transitionTo(target: PublicationStatus): PublicationStatus {
    if (!this.canTransitionTo(target)) {
      throw new ValidationError(
        `Cannot transition publication status from ${this.props.value} to ${target.props.value}`,
      );
    }
    return target;
  }

  public isPublished(): boolean {
    return this.props.value === PublicationStatusEnum.PUBLISHED;
  }

  public isDeleted(): boolean {
    return this.props.value === PublicationStatusEnum.DELETED;
  }

  public toString(): string {
    return this.props.value;
  }
}
