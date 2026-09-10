import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CONTENT_LIMITS } from '@csn/domain-shared';

export class CreateGroupPostDto {
  @ApiProperty({
    description: 'Post content text',
    maxLength: CONTENT_LIMITS.MAX_POST_LENGTH,
    example: 'Welcome to the group!',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_POST_LENGTH)
  content!: string;
}
