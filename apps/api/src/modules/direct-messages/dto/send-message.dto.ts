import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { MESSAGE_CONTENT_MAX_LENGTH } from '@csn/domain-direct-messages';

export class SendMessageDto {
  @ApiProperty({
    description: 'The message body',
    example: 'Are we still on for tomorrow?',
    minLength: 1,
    maxLength: MESSAGE_CONTENT_MAX_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_CONTENT_MAX_LENGTH)
  content!: string;
}
