import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Message,
  MessageContent,
  ConversationId,
  IConversationRepository,
  IMessageRepository,
} from '@csn/domain-direct-messages';
import { IBlockRepository } from '@csn/domain-social-graph';
import { AlertType } from '@csn/domain-notification';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from '@csn/infra-direct-messages';
import { SendMessageCommand } from './send-message.command';
import { MessageResponseDto } from '../dto/message-response.dto';
import { AlertCreatorService } from '../../notification/services/alert-creator.service';

@Injectable()
export class SendMessageHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepo: IConversationRepository,
    @Inject(MESSAGE_REPOSITORY_TOKEN)
    private readonly messageRepo: IMessageRepository,
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
    @Inject(AlertCreatorService)
    private readonly alerts: AlertCreatorService,
  ) {}

  async execute(command: SendMessageCommand): Promise<MessageResponseDto> {
    const conversation = await this.conversationRepo.findById(
      ConversationId.create(command.conversationId),
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const sender = UserId.create(command.senderId);
    if (!conversation.hasParticipant(sender)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const recipient = conversation.otherParticipant(sender);
    if (await this.blockRepo.isBlocked(sender, recipient)) {
      throw new BadRequestException('Cannot message this member');
    }

    let content: MessageContent;
    try {
      content = MessageContent.create(command.content);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const message = Message.create(
      this.messageRepo.nextId(),
      conversation,
      sender,
      content,
    );
    await this.messageRepo.save(message);

    // Re-sort the recipient's inbox to put this thread on top.
    conversation.recordActivity(message.createdAt);
    await this.conversationRepo.save(conversation);

    // Best-effort: never let an alert write break the send.
    await this.alerts.create({
      recipientId: recipient.value,
      actorId: sender.value,
      type: AlertType.MESSAGE,
      verb: 'sent you a message',
      body: content.value,
      actionUrl: `/messages/${conversation.id.value}`,
      sourceId: message.id.value,
    });

    return MessageResponseDto.fromDomain(message);
  }
}
