import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Conversation } from '../aggregates/conversation';
import { Message } from '../aggregates/message';
import { ConversationId } from '../value-objects/conversation-id';
import { MessageId } from '../value-objects/message-id';
import { MessageContent } from '../value-objects/message-content';
import { ParticipantPair } from '../value-objects/participant-pair';
import { MessageSentEvent } from '../events/message-sent.event';
import { MessageReadEvent } from '../events/message-read.event';
import { NotAParticipantError } from '../errors/not-a-participant.error';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

function makeConversation(): Conversation {
  const pair = ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB));
  const conversation = Conversation.create(ConversationId.generate(), pair);
  conversation.pullDomainEvents();
  return conversation;
}

function sendFrom(conversation: Conversation, senderId: string): Message {
  return Message.create(
    MessageId.generate(),
    conversation,
    UserId.create(senderId),
    MessageContent.create('hello'),
  );
}

describe('Message.create', () => {
  it('should reject a sender who is not a participant', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const act = () => sendFrom(conversation, CAROL);

    // Assert
    expect(act).toThrow(NotAParticipantError);
  });

  it('should attach the message to its conversation', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const message = sendFrom(conversation, ALICE);

    // Assert
    expect(message.conversationId.value).toBe(conversation.id.value);
  });

  it('should raise a MessageSentEvent', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const message = sendFrom(conversation, ALICE);

    // Assert
    expect(message.pullDomainEvents()[0]).toBeInstanceOf(MessageSentEvent);
  });

  it('should name the other participant as the recipient on the event', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);

    // Act
    const event = message.pullDomainEvents()[0] as MessageSentEvent;

    // Assert
    expect(event.recipientId).toBe(BOB);
  });

  it('should start out unread', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const message = sendFrom(conversation, ALICE);

    // Assert
    expect(message.readAt).toBeNull();
  });
});

describe('Message.markAsRead', () => {
  it('should stamp readAt when the recipient reads it', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);

    // Act
    message.markAsRead(UserId.create(BOB));

    // Assert
    expect(message.readAt).not.toBeNull();
  });

  it('should raise a MessageReadEvent when first read', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);
    message.pullDomainEvents();

    // Act
    message.markAsRead(UserId.create(BOB));

    // Assert
    expect(message.pullDomainEvents()[0]).toBeInstanceOf(MessageReadEvent);
  });

  it('should ignore a second read so the timestamp is stable', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);
    message.markAsRead(UserId.create(BOB));
    const firstReadAt = message.readAt?.toISO();

    // Act
    message.markAsRead(UserId.create(BOB));

    // Assert
    expect(message.readAt?.toISO()).toBe(firstReadAt);
  });

  it('should raise no event on a repeat read', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);
    message.markAsRead(UserId.create(BOB));
    message.pullDomainEvents();

    // Act
    message.markAsRead(UserId.create(BOB));

    // Assert
    expect(message.pullDomainEvents()).toHaveLength(0);
  });

  it('should not let the sender mark their own message read', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);

    // Act
    message.markAsRead(UserId.create(ALICE));

    // Assert
    expect(message.readAt).toBeNull();
  });
});

describe('Message.isUnreadFor', () => {
  it('should count an unread message as unread for its recipient', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);

    // Act
    const unread = message.isUnreadFor(UserId.create(BOB));

    // Assert
    expect(unread).toBe(true);
  });

  it('should never count a message as unread for its own sender', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);

    // Act
    const unread = message.isUnreadFor(UserId.create(ALICE));

    // Assert
    expect(unread).toBe(false);
  });

  it('should stop counting as unread once read', () => {
    // Arrange
    const conversation = makeConversation();
    const message = sendFrom(conversation, ALICE);
    message.markAsRead(UserId.create(BOB));

    // Act
    const unread = message.isUnreadFor(UserId.create(BOB));

    // Assert
    expect(unread).toBe(false);
  });
});

describe('Message.reconstitute', () => {
  it('should restore a read message without raising events', () => {
    // Act
    const message = Message.reconstitute(
      MessageId.generate(),
      ConversationId.generate(),
      UserId.create(ALICE),
      MessageContent.create('persisted'),
      Timestamp.now(),
      Timestamp.now(),
      4,
    );

    // Assert
    expect(message.pullDomainEvents()).toHaveLength(0);
  });

  it('should restore the persisted version number', () => {
    // Act
    const message = Message.reconstitute(
      MessageId.generate(),
      ConversationId.generate(),
      UserId.create(ALICE),
      MessageContent.create('persisted'),
      Timestamp.now(),
      null,
      4,
    );

    // Assert
    expect(message.version).toBe(4);
  });
});
