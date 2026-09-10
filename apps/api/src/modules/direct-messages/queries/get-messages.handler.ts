import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  ConversationId,
  MessageId,
  IConversationRepository,
  IMessageRepository,
} from '@csn/domain-direct-messages';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from '@csn/infra-direct-messages';
import { GetMessagesQuery } from './get-messages.query';
import { MessageResponseDto } from '../dto/message-response.dto';

export class MessagePageResult {
  constructor(
    public readonly items: MessageResponseDto[],
    public readonly nextCursor: string | null,
    public readonly hasMore: boolean,
  ) {}
}

@Injectable()
export class GetMessagesHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepo: IConversationRepository,
    @Inject(MESSAGE_REPOSITORY_TOKEN)
    private readonly messageRepo: IMessageRepository,
  ) {}

  async execute(query: GetMessagesQuery): Promise<MessagePageResult> {
    const conversationId = ConversationId.create(query.conversationId);
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const viewer = UserId.create(query.viewerId);
    if (!conversation.hasParticipant(viewer)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const page = await this.messageRepo.findPage(
      conversationId,
      query.cursor ? MessageId.create(query.cursor) : null,
      query.limit,
    );

    return new MessagePageResult(
      page.items.map(MessageResponseDto.fromDomain),
      page.nextCursor,
      page.hasMore,
    );
  }
}
