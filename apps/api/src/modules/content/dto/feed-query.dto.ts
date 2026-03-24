import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PAGINATION } from '@csn/domain-shared';

export class FeedQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (last post ID from previous page)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of posts to return',
    minimum: 1,
    maximum: PAGINATION.MAX_PAGE_SIZE,
    default: PAGINATION.DEFAULT_PAGE_SIZE,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION.MAX_PAGE_SIZE)
  limit?: number;
}
