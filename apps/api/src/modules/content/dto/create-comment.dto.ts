import { IsNotEmpty, IsString, MaxLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONTENT_LIMITS } from '@csn/domain-shared';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment text content',
    maxLength: CONTENT_LIMITS.MAX_COMMENT_LENGTH,
    example: 'Great post! Thanks for sharing.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_COMMENT_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    description: 'Parent comment ID for threaded replies',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
