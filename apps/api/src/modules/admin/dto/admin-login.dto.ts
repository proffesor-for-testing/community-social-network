import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@csn.example.com',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'Adm1n!Secur3#2024',
  })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
