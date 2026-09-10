import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  Message,
  MessageId,
  MessageContent,
  ParticipantPair,
} from '@csn/domain-direct-messages';
import { InMemoryDirectMessageRepository } from '../repositories/in-memory-direct-message.repository';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

let repo: InMemoryDirectMessageRepository;
let conversation: Conversation;

function makeConversation(): Conversation {
  return Conversation.create(
    ConversationId.generate(),
    ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB)),
  );
}

async function send(senderId: string, body: string): Promise<Message> {
  const message = Message.create(
    MessageId.generate(),
    conversation,
    UserId.create(senderId),
    MessageContent.create(body),
  );
  await repo.save(message);
  return message;
}

beforeEach(() => {
  repo = new InMemoryDirectMessageRepository();
  conversation = makeConversation();
});

describe('InMemoryDirectMessageRepository.findPage', () => {
  it('should return an empty page for a conversation with no messages', async () => {
    // Act
    const page = await repo.findPage(conversation.id, null, 20);

    // Assert
    expect(page.items).toEqual([]);
  });

  it('should return the page oldest-first', async () => {
    // Arrange
    const first = await send(ALICE, 'one');
    await send(BOB, 'two');

    // Act
    const page = await repo.findPage(conversation.id, null, 20);

    // Assert
    expect(page.items[0].id.value).toBe(first.id.value);
  });

  it('should serve the newest messages when no cursor is given', async () => {
    // Arrange
    await send(ALICE, 'one');
    await send(ALICE, 'two');
    const newest = await send(ALICE, 'three');

    // Act
    const page = await repo.findPage(conversation.id, null, 2);

    // Assert
    expect(page.items[page.items.length - 1].id.value).toBe(newest.id.value);
  });

  it('should report more history when the conversation is longer than the limit', async () => {
    // Arrange
    await send(ALICE, 'one');
    await send(ALICE, 'two');
    await send(ALICE, 'three');

    // Act
    const page = await repo.findPage(conversation.id, null, 2);

    // Assert
    expect(page.hasMore).toBe(true);
  });

  it('should point nextCursor at the oldest message of the page', async () => {
    // Arrange
    await send(ALICE, 'one');
    const second = await send(ALICE, 'two');
    await send(ALICE, 'three');

    // Act
    const page = await repo.findPage(conversation.id, null, 2);

    // Assert
    expect(page.nextCursor).toBe(second.id.value);
  });

  it('should return null nextCursor on the last page', async () => {
    // Arrange
    await send(ALICE, 'one');
    await send(ALICE, 'two');

    // Act
    const page = await repo.findPage(conversation.id, null, 20);

    // Assert
    expect(page.nextCursor).toBeNull();
  });

  it('should return the messages older than the cursor', async () => {
    // Arrange
    const oldest = await send(ALICE, 'one');
    const second = await send(ALICE, 'two');
    await send(ALICE, 'three');

    // Act
    const page = await repo.findPage(conversation.id, second.id, 20);

    // Assert
    expect(page.items.map((m) => m.id.value)).toEqual([oldest.id.value]);
  });

  it('should return an empty page when the cursor is the oldest message', async () => {
    // Arrange
    const oldest = await send(ALICE, 'one');
    await send(ALICE, 'two');

    // Act
    const page = await repo.findPage(conversation.id, oldest.id, 20);

    // Assert
    expect(page.items).toEqual([]);
  });

  it('should treat an unknown cursor as the end of history', async () => {
    // Arrange
    await send(ALICE, 'one');

    // Act
    const page = await repo.findPage(conversation.id, MessageId.generate(), 20);

    // Assert
    expect(page.hasMore).toBe(false);
  });

  it('should not leak messages from another conversation', async () => {
    // Arrange
    await send(ALICE, 'one');
    const other = makeConversation();

    // Act
    const page = await repo.findPage(other.id, null, 20);

    // Assert
    expect(page.items).toEqual([]);
  });
});

describe('InMemoryDirectMessageRepository.findLastByConversationIds', () => {
  it('should return the newest message per conversation', async () => {
    // Arrange
    await send(ALICE, 'one');
    const newest = await send(BOB, 'two');

    // Act
    const last = await repo.findLastByConversationIds([conversation.id]);

    // Assert
    expect(last.get(conversation.id.value)?.id.value).toBe(newest.id.value);
  });

  it('should omit conversations that have no messages', async () => {
    // Arrange
    const empty = makeConversation();

    // Act
    const last = await repo.findLastByConversationIds([empty.id]);

    // Assert
    expect(last.has(empty.id.value)).toBe(false);
  });

  it('should return an empty map for an empty id list', async () => {
    // Act
    const last = await repo.findLastByConversationIds([]);

    // Assert
    expect(last.size).toBe(0);
  });
});

describe('InMemoryDirectMessageRepository unread counting', () => {
  it('should count messages addressed to the viewer', async () => {
    // Arrange
    await send(ALICE, 'one');
    await send(ALICE, 'two');

    // Act
    const counts = await repo.countUnreadByConversationIds(
      [conversation.id],
      UserId.create(BOB),
    );

    // Assert
    expect(counts.get(conversation.id.value)).toBe(2);
  });

  it('should not count the viewer\'s own messages', async () => {
    // Arrange
    await send(ALICE, 'one');

    // Act
    const counts = await repo.countUnreadByConversationIds(
      [conversation.id],
      UserId.create(ALICE),
    );

    // Assert
    expect(counts.has(conversation.id.value)).toBe(false);
  });

  it('should decrement the count once a message is read', async () => {
    // Arrange
    const first = await send(ALICE, 'one');
    await send(ALICE, 'two');
    first.markAsRead(UserId.create(BOB));
    await repo.save(first);

    // Act
    const counts = await repo.countUnreadByConversationIds(
      [conversation.id],
      UserId.create(BOB),
    );

    // Assert
    expect(counts.get(conversation.id.value)).toBe(1);
  });

  it('should drop the conversation from the map once everything is read', async () => {
    // Arrange
    const only = await send(ALICE, 'one');
    only.markAsRead(UserId.create(BOB));
    await repo.save(only);

    // Act
    const counts = await repo.countUnreadByConversationIds(
      [conversation.id],
      UserId.create(BOB),
    );

    // Assert
    expect(counts.has(conversation.id.value)).toBe(false);
  });
});

describe('InMemoryDirectMessageRepository.findUnreadForRecipient', () => {
  it('should return the viewer\'s unread messages oldest-first', async () => {
    // Arrange
    const first = await send(ALICE, 'one');
    await send(ALICE, 'two');

    // Act
    const unread = await repo.findUnreadForRecipient(
      conversation.id,
      UserId.create(BOB),
    );

    // Assert
    expect(unread[0].id.value).toBe(first.id.value);
  });

  it('should exclude messages the viewer sent', async () => {
    // Arrange
    await send(BOB, 'mine');

    // Act
    const unread = await repo.findUnreadForRecipient(
      conversation.id,
      UserId.create(BOB),
    );

    // Assert
    expect(unread).toEqual([]);
  });

  it('should exclude already-read messages', async () => {
    // Arrange
    const message = await send(ALICE, 'one');
    message.markAsRead(UserId.create(BOB));
    await repo.save(message);

    // Act
    const unread = await repo.findUnreadForRecipient(
      conversation.id,
      UserId.create(BOB),
    );

    // Assert
    expect(unread).toEqual([]);
  });
});
