import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  Message,
  MessageContent,
  ParticipantPair,
} from '@csn/domain-direct-messages';
import {
  InMemoryConversationRepository,
  InMemoryDirectMessageRepository,
} from '@csn/infra-direct-messages';
import { MarkConversationReadHandler } from '../commands/mark-conversation-read.handler';
import { MarkConversationReadCommand } from '../commands/mark-conversation-read.command';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

let conversationRepo: InMemoryConversationRepository;
let messageRepo: InMemoryDirectMessageRepository;
let handler: MarkConversationReadHandler;
let conversation: Conversation;

async function send(senderId: string, body: string): Promise<void> {
  const message = Message.create(
    messageRepo.nextId(),
    conversation,
    UserId.create(senderId),
    MessageContent.create(body),
  );
  await messageRepo.save(message);
}

beforeEach(async () => {
  conversationRepo = new InMemoryConversationRepository();
  messageRepo = new InMemoryDirectMessageRepository();
  handler = new MarkConversationReadHandler(conversationRepo, messageRepo);
  conversation = await conversationRepo.findOrCreate(
    ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB)),
  );
});

describe('MarkConversationReadHandler', () => {
  it('should report how many messages it marked read', async () => {
    // Arrange
    await send(ALICE, 'one');
    await send(ALICE, 'two');

    // Act
    const result = await handler.execute(
      new MarkConversationReadCommand(conversation.id.value, BOB),
    );

    // Assert
    expect(result.markedCount).toBe(2);
  });

  it('should drive the viewer\'s unread count to zero', async () => {
    // Arrange
    await send(ALICE, 'one');
    await handler.execute(new MarkConversationReadCommand(conversation.id.value, BOB));

    // Act
    const counts = await messageRepo.countUnreadByConversationIds(
      [conversation.id],
      UserId.create(BOB),
    );

    // Assert
    expect(counts.get(conversation.id.value) ?? 0).toBe(0);
  });

  it('should leave the sender\'s own messages untouched', async () => {
    // Arrange
    await send(BOB, 'mine');

    // Act
    const result = await handler.execute(
      new MarkConversationReadCommand(conversation.id.value, BOB),
    );

    // Assert
    expect(result.markedCount).toBe(0);
  });

  it('should be idempotent on a second call', async () => {
    // Arrange
    await send(ALICE, 'one');
    await handler.execute(new MarkConversationReadCommand(conversation.id.value, BOB));

    // Act
    const result = await handler.execute(
      new MarkConversationReadCommand(conversation.id.value, BOB),
    );

    // Assert
    expect(result.markedCount).toBe(0);
  });

  it('should reject a non-participant', async () => {
    // Act
    const act = handler.execute(
      new MarkConversationReadCommand(conversation.id.value, CAROL),
    );

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should reject an unknown conversation', async () => {
    // Act
    const act = handler.execute(
      new MarkConversationReadCommand(ConversationId.generate().value, BOB),
    );

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
  });
});
