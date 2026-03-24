import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { CONTENT_LIMITS } from '@csn/domain-shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH)
  @MaxLength(CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.MAX_BIO_LENGTH)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
