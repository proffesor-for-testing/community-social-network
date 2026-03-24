import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { SECURITY_LIMITS, CONTENT_LIMITS } from '@csn/domain-shared';

export class RegisterDto {
  @ApiProperty({
    description: 'A valid email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Display name visible to other members',
    example: 'Jane Doe',
    minLength: CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH,
    maxLength: CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH,
  })
  @IsString()
  @MinLength(CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH, {
    message: `Display name must be at least ${CONTENT_LIMITS.MIN_DISPLAY_NAME_LENGTH} characters`,
  })
  @MaxLength(CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH, {
    message: `Display name must not exceed ${CONTENT_LIMITS.MAX_DISPLAY_NAME_LENGTH} characters`,
  })
  displayName!: string;

  @ApiProperty({
    description: `Password (min ${SECURITY_LIMITS.PASSWORD_MIN_LENGTH} chars, requires uppercase, lowercase, digit, and special character)`,
    example: 'Str0ng!Pass#2024',
    minLength: SECURITY_LIMITS.PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @MinLength(SECURITY_LIMITS.PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${SECURITY_LIMITS.PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one digit' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, {
    message: 'Password must contain at least one special character',
  })
  password!: string;
}
