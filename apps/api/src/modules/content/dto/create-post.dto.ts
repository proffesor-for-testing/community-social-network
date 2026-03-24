import { IsNotEmpty, IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONTENT_LIMITS } from '@csn/domain-shared';
import { VisibilityEnum } from '@csn/domain-content';

export class CreatePostDto {
  @ApiProperty({
    description: 'Post content text',
    maxLength: CONTENT_LIMITS.MAX_POST_LENGTH,
    example: 'Hello world! This is my first post.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_POST_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    description: 'Post visibility',
    enum: VisibilityEnum,
    default: VisibilityEnum.PUBLIC,
    example: VisibilityEnum.PUBLIC,
  })
  @IsOptional()
  @IsEnum(VisibilityEnum)
  visibility?: VisibilityEnum;
}
