import { ValueObject, ValidationError } from '@csn/domain-shared';

export enum VisibilityEnum {
  PUBLIC = 'PUBLIC',
  CONNECTIONS_ONLY = 'CONNECTIONS_ONLY',
  GROUP_ONLY = 'GROUP_ONLY',
  PRIVATE = 'PRIVATE',
}

interface VisibilityProps {
  value: VisibilityEnum;
}

export class Visibility extends ValueObject<VisibilityProps> {
  private constructor(props: VisibilityProps) {
    super(props);
  }

  public static create(value: string): Visibility {
    if (!Object.values(VisibilityEnum).includes(value as VisibilityEnum)) {
      throw new ValidationError(
        `Invalid visibility: ${value}. Must be one of: ${Object.values(VisibilityEnum).join(', ')}`,
      );
    }
    return new Visibility({ value: value as VisibilityEnum });
  }

  public static get PUBLIC(): Visibility {
    return new Visibility({ value: VisibilityEnum.PUBLIC });
  }

  public static get CONNECTIONS_ONLY(): Visibility {
    return new Visibility({ value: VisibilityEnum.CONNECTIONS_ONLY });
  }

  public static get GROUP_ONLY(): Visibility {
    return new Visibility({ value: VisibilityEnum.GROUP_ONLY });
  }

  public static get PRIVATE(): Visibility {
    return new Visibility({ value: VisibilityEnum.PRIVATE });
  }

  public get value(): VisibilityEnum {
    return this.props.value;
  }

  public isPublic(): boolean {
    return this.props.value === VisibilityEnum.PUBLIC;
  }

  public toString(): string {
    return this.props.value;
  }
}
