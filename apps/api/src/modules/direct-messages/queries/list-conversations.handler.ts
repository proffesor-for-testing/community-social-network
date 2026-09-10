import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  IConversationRepository,
  IMessageRepository,
} from '@csn/domain-direct-messages';
import { IProfileRepository } from '@csn/domain-profile';
import {
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from '@csn/infra-direct-messages';
import { ListConversationsQuery } from './list-conversations.query';
import { ConversationResponseDto } from '../dto/conversation-response.dto';

export class ConversationListResult {
  constructor(
    public readonly items: ConversationResponseDto[],
    public readonly totalUnread: number,
  ) {}
}

@Injectable()
export class ListConversationsHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepo: IConversationRepository,
    @Inject(MESSAGE_REPOSITORY_TOKEN)
    private readonly messageRepo: IMessageRepository,
    @Inject('IProfileRepository')
    private readonly profileRepo: IProfileRepository,
  ) {}

  async execute(query: ListConversationsQuery): Promise<ConversationListResult> {
    const viewer = UserId.create(query.viewerId);
    const conversations = await this.conversationRepo.findByParticipant(viewer);

    if (conversations.length === 0) {
      return new ConversationListResult([], 0);
    }

    const conversationIds = conversations.map((c) => c.id);

    // Three batch round-trips rather than three per conversation.
    const [lastMessages, unreadCounts, profiles] = await Promise.all([
      this.messageRepo.findLastByConversationIds(conversationIds),
      this.messageRepo.countUnreadByConversationIds(conversationIds, viewer),
      this.profileRepo.findByMemberIds(
        conversations.map((c) => c.otherParticipant(viewer)),
      ),
    ]);

    let totalUnread = 0;
    const items = conversations.map((conversation) => {
      const otherId = conversation.otherParticipant(viewer).value;
      const unreadCount = unreadCounts.get(conversation.id.value) ?? 0;
      totalUnread += unreadCount;

      return ConversationResponseDto.fromDomain(
        conversation,
        viewer,
        profiles.get(otherId)?.displayName.value ?? 'Member',
        lastMessages.get(conversation.id.value) ?? null,
        unreadCount,
      );
    });

    return new ConversationListResult(items, totalUnread);
  }
}
