import { IRepository, UserId } from '@csn/domain-shared';
import { Message } from '../aggregates/message';
import { MessageId } from '../value-objects/message-id';
import { ConversationId } from '../value-objects/conversation-id';

/**
 * One page of a conversation's history. `items` runs oldest -> newest so the
 * thread view can render it top-to-bottom without reversing, while
 * `nextCursor` points further back in time.
 */
export interface MessagePage {
  items: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface IMessageRepository extends IRepository<Message, MessageId> {
  /**
   * The `limit` newest messages older than `before` (or the newest overall
   * when `before` is null), returned oldest -> newest.
   */
  findPage(
    conversationId: ConversationId,
    before: MessageId | null,
    limit: number,
  ): Promise<MessagePage>;

  /** Batch lookup of each conversation's most recent message, keyed by conversation id. */
  findLastByConversationIds(
    conversationIds: ConversationId[],
  ): Promise<Map<string, Message>>;

  /** Batch unread counts for the viewer, keyed by conversation id. */
  countUnreadByConversationIds(
    conversationIds: ConversationId[],
    viewerId: UserId,
  ): Promise<Map<string, number>>;

  /** Messages in the conversation addressed to the viewer that are still unread. */
  findUnreadForRecipient(
    conversationId: ConversationId,
    recipientId: UserId,
  ): Promise<Message[]>;
}
