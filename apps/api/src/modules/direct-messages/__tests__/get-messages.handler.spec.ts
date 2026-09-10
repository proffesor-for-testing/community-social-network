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
import { GetMessagesHandler } from '../queries/get-messages.handler';
import { GetMessagesQuery } from '../queries/get-messages.query';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

let conversationRepo: InMemoryConversationRepository;
let messageRepo: InMemoryDirectMessageRepository;
let handler: GetMessagesHandler;
let conversation: Conversation;

async function send(body: string): Promise<Message> {
  const message = Message.create(
    messageRepo.nextId(),
    conversation,
    UserId.create(ALICE),
    MessageContent.create(body),
  );
  await messageRepo.save(message);
  return message;
}

beforeEach(async () => {
  conversationRepo = new InMemoryConversationRepository();
  messageRepo = new InMemoryDirectMessageRepository();
  handler = new GetMessagesHandler(conversationRepo, messageRepo);
  conversation = await conversationRepo.findOrCreate(
    ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB)),
  );
});

describe('GetMessagesHandler', () => {
  it('should return the page oldest-first', async () => {
    // Arrange
    const first = await send('one');
    await send('two');

    // Act
    const result = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE),
    );

    // Assert
    expect(result.items[0].id).toBe(first.id.value);
  });

  it('should limit the page to the requested size', async () => {
    // Arrange
    await send('one');
    await send('two');
    await send('three');

    // Act
    const result = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, null, 2),
    );

    // Assert
    expect(result.items).toHaveLength(2);
  });

  it('should report more history beyond the page', async () => {
    // Arrange
    await send('one');
    await send('two');
    await send('three');

    // Act
    const result = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, null, 2),
    );

    // Assert
    expect(result.hasMore).toBe(true);
  });

  it('should walk back through history with the cursor', async () => {
    // Arrange
    const oldest = await send('one');
    await send('two');
    await send('three');
    const firstPage = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, null, 2),
    );

    // Act
    const secondPage = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, firstPage.nextCursor, 2),
    );

    // Assert
    expect(secondPage.items.map((m) => m.id)).toEqual([oldest.id.value]);
  });

  it('should report no further history on the final page', async () => {
    // Arrange
    await send('one');
    await send('two');
    const firstPage = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, null, 1),
    );

    // Act
    const secondPage = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE, firstPage.nextCursor, 1),
    );

    // Assert
    expect(secondPage.hasMore).toBe(false);
  });

  it('should return an empty page for a conversation with no messages', async () => {
    // Act
    const result = await handler.execute(
      new GetMessagesQuery(conversation.id.value, ALICE),
    );

    // Assert
    expect(result.items).toEqual([]);
  });

  it('should reject a viewer who is not a participant', async () => {
    // Act
    const act = handler.execute(new GetMessagesQuery(conversation.id.value, CAROL));

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should reject an unknown conversation', async () => {
    // Act
    const act = handler.execute(
      new GetMessagesQuery(ConversationId.generate().value, ALICE),
    );

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
  });
});
