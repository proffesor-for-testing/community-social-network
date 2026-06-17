import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CONTENT_LIMITS } from '@csn/domain-shared';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Replacement comment text',
    maxLength: CONTENT_LIMITS.MAX_COMMENT_LENGTH,
    example: 'Edited comment body.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_COMMENT_LENGTH)
  content!: string;
}
