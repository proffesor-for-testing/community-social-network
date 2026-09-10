import { ApiProperty } from '@nestjs/swagger';
import { Message } from '@csn/domain-direct-messages';

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  readAt!: string | null;

  static fromDomain(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id.value;
    dto.conversationId = message.conversationId.value;
    dto.senderId = message.senderId.value;
    dto.content = message.content.value;
    dto.createdAt = message.createdAt.toISO();
    dto.readAt = message.readAt ? message.readAt.toISO() : null;
    return dto;
  }
}
