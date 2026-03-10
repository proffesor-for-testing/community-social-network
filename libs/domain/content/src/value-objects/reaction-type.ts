import { ValueObject, ValidationError } from '@csn/domain-shared';

export enum ReactionTypeEnum {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  HAHA = 'HAHA',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
}

interface ReactionTypeProps {
  value: ReactionTypeEnum;
}

export class ReactionType extends ValueObject<ReactionTypeProps> {
  private constructor(props: ReactionTypeProps) {
    super(props);
  }

  public static create(value: string): ReactionType {
    if (!Object.values(ReactionTypeEnum).includes(value as ReactionTypeEnum)) {
      throw new ValidationError(
        `Invalid reaction type: ${value}. Must be one of: ${Object.values(ReactionTypeEnum).join(', ')}`,
      );
    }
    return new ReactionType({ value: value as ReactionTypeEnum });
  }

  public static get LIKE(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.LIKE });
  }

  public static get LOVE(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.LOVE });
  }

  public static get HAHA(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.HAHA });
  }

  public static get WOW(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.WOW });
  }

  public static get SAD(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.SAD });
  }

  public static get ANGRY(): ReactionType {
    return new ReactionType({ value: ReactionTypeEnum.ANGRY });
  }

  public get value(): ReactionTypeEnum {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
