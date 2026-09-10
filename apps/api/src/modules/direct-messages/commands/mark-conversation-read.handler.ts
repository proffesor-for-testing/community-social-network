import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  ConversationId,
  IConversationRepository,
  IMessageRepository,
} from '@csn/domain-direct-messages';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from '@csn/infra-direct-messages';
import { MarkConversationReadCommand } from './mark-conversation-read.command';

export class MarkConversationReadResult {
  constructor(public readonly markedCount: number) {}
}

@Injectable()
export class MarkConversationReadHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepo: IConversationRepository,
    @Inject(MESSAGE_REPOSITORY_TOKEN)
    private readonly messageRepo: IMessageRepository,
  ) {}

  async execute(
    command: MarkConversationReadCommand,
  ): Promise<MarkConversationReadResult> {
    const conversationId = ConversationId.create(command.conversationId);
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const viewer = UserId.create(command.viewerId);
    if (!conversation.hasParticipant(viewer)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const unread = await this.messageRepo.findUnreadForRecipient(
      conversationId,
      viewer,
    );

    for (const message of unread) {
      message.markAsRead(viewer);
      await this.messageRepo.save(message);
    }

    return new MarkConversationReadResult(unread.length);
  }
}
