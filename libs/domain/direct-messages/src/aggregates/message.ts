import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { MessageId } from '../value-objects/message-id';
import { MessageContent } from '../value-objects/message-content';
import { ConversationId } from '../value-objects/conversation-id';
import { Conversation } from './conversation';
import { MessageSentEvent } from '../events/message-sent.event';
import { MessageReadEvent } from '../events/message-read.event';

/**
 * A single direct message. Created through the owning Conversation so the
 * "sender must be a participant" invariant cannot be bypassed.
 */
export class Message extends AggregateRoot<MessageId> {
  private _conversationId: ConversationId;
  private _senderId: UserId;
  private _content: MessageContent;
  private _createdAt: Timestamp;
  private _readAt: Timestamp | null;

  private constructor(
    id: MessageId,
    conversationId: ConversationId,
    senderId: UserId,
    content: MessageContent,
    createdAt: Timestamp,
    readAt: Timestamp | null,
  ) {
    super(id);
    this._conversationId = conversationId;
    this._senderId = senderId;
    this._content = content;
    this._createdAt = createdAt;
    this._readAt = readAt;
  }

  public static create(
    id: MessageId,
    conversation: Conversation,
    senderId: UserId,
    content: MessageContent,
  ): Message {
    conversation.assertParticipant(senderId);

    const message = new Message(
      id,
      conversation.id,
      senderId,
      content,
      Timestamp.now(),
      null,
    );

    message.addDomainEvent(
      new MessageSentEvent(
        id.value,
        conversation.id.value,
        senderId.value,
        conversation.otherParticipant(senderId).value,
      ),
    );
    message.incrementVersion();

    return message;
  }

  /** Rebuild a Message from persistence without emitting events. */
  public static reconstitute(
    id: MessageId,
    conversationId: ConversationId,
    senderId: UserId,
    content: MessageContent,
    createdAt: Timestamp,
    readAt: Timestamp | null,
    version: number,
  ): Message {
    const message = new Message(
      id,
      conversationId,
      senderId,
      content,
      createdAt,
      readAt,
    );
    message.setVersion(version);
    return message;
  }

  /**
   * Marks the message read by its recipient. Idempotent: re-reading an
   * already-read message is a no-op rather than an error, because the FE marks
   * a whole thread read every time it is opened.
   */
  public markAsRead(readerId: UserId): void {
    if (this._readAt !== null) {
      return;
    }
    if (this._senderId.value === readerId.value) {
      return; // your own message is never "unread" for you
    }

    this._readAt = Timestamp.now();
    this.addDomainEvent(
      new MessageReadEvent(
        this.id.value,
        this._conversationId.value,
        readerId.value,
        this.version + 1,
      ),
    );
    this.incrementVersion();
  }

  /** True when the message is addressed to `viewerId` and not yet read. */
  public isUnreadFor(viewerId: UserId): boolean {
    return this._readAt === null && this._senderId.value !== viewerId.value;
  }

  public get conversationId(): ConversationId {
    return this._conversationId;
  }

  public get senderId(): UserId {
    return this._senderId;
  }

  public get content(): MessageContent {
    return this._content;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get readAt(): Timestamp | null {
    return this._readAt;
  }
}
