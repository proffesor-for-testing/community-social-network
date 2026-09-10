import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({
    description: 'The member to open a conversation with',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  recipientId!: string;
}
