import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({
    description: 'Reason for suspending the user',
    example: 'Repeated violation of community guidelines',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(1000, { message: 'Reason must not exceed 1000 characters' })
  reason!: string;
}
