import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'Str0ng!Pass#2024',
  })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
