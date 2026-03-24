import { IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReactionTypeEnum } from '@csn/domain-content';

export class ReactDto {
  @ApiProperty({
    description: 'Type of reaction',
    enum: ReactionTypeEnum,
    example: ReactionTypeEnum.LIKE,
  })
  @IsNotEmpty()
  @IsEnum(ReactionTypeEnum)
  reactionType!: ReactionTypeEnum;
}
