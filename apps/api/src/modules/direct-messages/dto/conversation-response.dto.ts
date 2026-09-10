import { ApiProperty } from '@nestjs/swagger';
import { UserId } from '@csn/domain-shared';
import { Conversation, Message } from '@csn/domain-direct-messages';
import { MessageResponseDto } from './message-response.dto';

/** The other person in a 1:1 conversation, as the inbox needs to render them. */
export class ConversationParticipantDto {
  @ApiProperty()
  memberId!: string;

  @ApiProperty()
  displayName!: string;
}

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: ConversationParticipantDto })
  otherParticipant!: ConversationParticipantDto;

  @ApiProperty({ type: MessageResponseDto, nullable: true })
  lastMessage!: MessageResponseDto | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromDomain(
    conversation: Conversation,
    viewerId: UserId,
    otherDisplayName: string,
    lastMessage: Message | null = null,
    unreadCount = 0,
  ): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    const other = conversation.otherParticipant(viewerId);

    dto.id = conversation.id.value;
    dto.otherParticipant = {
      memberId: other.value,
      displayName: otherDisplayName,
    };
    dto.lastMessage = lastMessage ? MessageResponseDto.fromDomain(lastMessage) : null;
    dto.unreadCount = unreadCount;
    dto.createdAt = conversation.createdAt.toISO();
    dto.updatedAt = conversation.updatedAt.toISO();
    return dto;
  }
}
