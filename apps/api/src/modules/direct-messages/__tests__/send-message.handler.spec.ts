import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  ParticipantPair,
  MESSAGE_CONTENT_MAX_LENGTH,
} from '@csn/domain-direct-messages';
import {
  InMemoryConversationRepository,
  InMemoryDirectMessageRepository,
} from '@csn/infra-direct-messages';
import { AlertType } from '@csn/domain-notification';
import { SendMessageHandler } from '../commands/send-message.handler';
import { SendMessageCommand } from '../commands/send-message.command';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

let conversationRepo: InMemoryConversationRepository;
let messageRepo: InMemoryDirectMessageRepository;
let blockRepo: { isBlocked: ReturnType<typeof vi.fn> };
let alerts: { create: ReturnType<typeof vi.fn> };
let handler: SendMessageHandler;
let conversation: Conversation;

beforeEach(async () => {
  conversationRepo = new InMemoryConversationRepository();
  messageRepo = new InMemoryDirectMessageRepository();
  blockRepo = { isBlocked: vi.fn().mockResolvedValue(false) };
  alerts = { create: vi.fn().mockResolvedValue(undefined) };
  handler = new SendMessageHandler(
    conversationRepo,
    messageRepo,
    blockRepo as never,
    alerts as never,
  );
  conversation = await conversationRepo.findOrCreate(
    ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB)),
  );
});

describe('SendMessageHandler', () => {
  it('should persist the message', async () => {
    // Act
    await handler.execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'));

    // Assert
    expect(messageRepo.size).toBe(1);
  });

  it('should return the message content', async () => {
    // Act
    const result = await handler.execute(
      new SendMessageCommand(conversation.id.value, ALICE, 'hi'),
    );

    // Assert
    expect(result.content).toBe('hi');
  });

  it('should return the message unread', async () => {
    // Act
    const result = await handler.execute(
      new SendMessageCommand(conversation.id.value, ALICE, 'hi'),
    );

    // Assert
    expect(result.readAt).toBeNull();
  });

  it('should bump the conversation activity clock', async () => {
    // Arrange
    const before = conversation.updatedAt.value.getTime();

    // Act
    await handler.execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'));

    // Assert
    expect(conversation.updatedAt.value.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('should notify the recipient with a MESSAGE alert', async () => {
    // Act
    await handler.execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'));

    // Assert
    expect(alerts.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: BOB, type: AlertType.MESSAGE }),
    );
  });

  it('should deep-link the alert to the conversation', async () => {
    // Act
    await handler.execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'));

    // Assert
    expect(alerts.create).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: `/messages/${conversation.id.value}` }),
    );
  });

  it('should reject a sender who is not a participant', async () => {
    // Act
    const act = handler.execute(
      new SendMessageCommand(conversation.id.value, CAROL, 'hi'),
    );

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should reject a message to an unknown conversation', async () => {
    // Act
    const act = handler.execute(
      new SendMessageCommand(ConversationId.generate().value, ALICE, 'hi'),
    );

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
  });

  it('should reject empty content', async () => {
    // Act
    const act = handler.execute(new SendMessageCommand(conversation.id.value, ALICE, ''));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should reject whitespace-only content', async () => {
    // Act
    const act = handler.execute(
      new SendMessageCommand(conversation.id.value, ALICE, '   '),
    );

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should accept content of exactly the maximum length', async () => {
    // Arrange
    const body = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH);

    // Act
    const result = await handler.execute(
      new SendMessageCommand(conversation.id.value, ALICE, body),
    );

    // Assert
    expect(result.content).toHaveLength(MESSAGE_CONTENT_MAX_LENGTH);
  });

  it('should reject content one character over the maximum length', async () => {
    // Arrange
    const body = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH + 1);

    // Act
    const act = handler.execute(
      new SendMessageCommand(conversation.id.value, ALICE, body),
    );

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should reject a message to a member who blocked the sender', async () => {
    // Arrange
    blockRepo.isBlocked.mockResolvedValue(true);

    // Act
    const act = handler.execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should not persist a message to a blocked pair', async () => {
    // Arrange
    blockRepo.isBlocked.mockResolvedValue(true);

    // Act
    await handler
      .execute(new SendMessageCommand(conversation.id.value, ALICE, 'hi'))
      .catch(() => undefined);

    // Assert
    expect(messageRepo.size).toBe(0);
  });
});
