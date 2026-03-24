import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class Setup2faDto {
  @ApiProperty({
    description: 'TOTP verification code to confirm 2FA setup',
    example: '654321',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code!: string;
}
