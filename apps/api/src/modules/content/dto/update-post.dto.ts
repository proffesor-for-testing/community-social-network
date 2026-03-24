import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CONTENT_LIMITS } from '@csn/domain-shared';

export class UpdatePostDto {
  @ApiPropertyOptional({
    description: 'Updated post content text',
    maxLength: CONTENT_LIMITS.MAX_POST_LENGTH,
    example: 'Updated content for my post.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_POST_LENGTH)
  content?: string;
}
