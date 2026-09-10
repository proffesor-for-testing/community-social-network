import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Conversation,
  Message,
  MessageContent,
  ParticipantPair,
} from '@csn/domain-direct-messages';
import {
  InMemoryConversationRepository,
  InMemoryDirectMessageRepository,
} from '@csn/infra-direct-messages';
import { ListConversationsHandler } from '../queries/list-conversations.handler';
import { ListConversationsQuery } from '../queries/list-conversations.query';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

let conversationRepo: InMemoryConversationRepository;
let messageRepo: InMemoryDirectMessageRepository;
let profileRepo: { findByMemberIds: ReturnType<typeof vi.fn> };
let handler: ListConversationsHandler;

function profileMap(entries: Array<[string, string]>) {
  return new Map(entries.map(([id, name]) => [id, { displayName: { value: name } }]));
}

async function open(a: string, b: string): Promise<Conversation> {
  return conversationRepo.findOrCreate(
    ParticipantPair.create(UserId.create(a), UserId.create(b)),
  );
}

async function send(
  conversation: Conversation,
  senderId: string,
  body: string,
): Promise<Message> {
  const message = Message.create(
    messageRepo.nextId(),
    conversation,
    UserId.create(senderId),
    MessageContent.create(body),
  );
  await messageRepo.save(message);
  return message;
}

beforeEach(() => {
  conversationRepo = new InMemoryConversationRepository();
  messageRepo = new InMemoryDirectMessageRepository();
  profileRepo = {
    findByMemberIds: vi
      .fn()
      .mockResolvedValue(profileMap([[BOB, 'Bob Builder'], [CAROL, 'Carol Coder']])),
  };
  handler = new ListConversationsHandler(
    conversationRepo,
    messageRepo,
    profileRepo as never,
  );
});

describe('ListConversationsHandler', () => {
  it('should return an empty list when the viewer has no conversations', async () => {
    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items).toEqual([]);
  });

  it('should not query profiles when there are no conversations', async () => {
    // Act
    await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(profileRepo.findByMemberIds).not.toHaveBeenCalled();
  });

  it('should name the other participant', async () => {
    // Arrange
    await open(ALICE, BOB);

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].otherParticipant.displayName).toBe('Bob Builder');
  });

  it('should fall back to "Member" when the other participant has no profile', async () => {
    // Arrange
    await open(ALICE, BOB);
    profileRepo.findByMemberIds.mockResolvedValue(new Map());

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].otherParticipant.displayName).toBe('Member');
  });

  it('should include the last message as a preview', async () => {
    // Arrange
    const conversation = await open(ALICE, BOB);
    await send(conversation, ALICE, 'first');
    await send(conversation, BOB, 'latest');

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].lastMessage?.content).toBe('latest');
  });

  it('should report a null last message for an empty conversation', async () => {
    // Arrange
    await open(ALICE, BOB);

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].lastMessage).toBeNull();
  });

  it('should count messages the viewer has not read', async () => {
    // Arrange
    const conversation = await open(ALICE, BOB);
    await send(conversation, BOB, 'one');
    await send(conversation, BOB, 'two');

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].unreadCount).toBe(2);
  });

  it('should not count the viewer\'s own messages as unread', async () => {
    // Arrange
    const conversation = await open(ALICE, BOB);
    await send(conversation, ALICE, 'mine');

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].unreadCount).toBe(0);
  });

  it('should sum unread counts across conversations', async () => {
    // Arrange
    const withBob = await open(ALICE, BOB);
    const withCarol = await open(ALICE, CAROL);
    await send(withBob, BOB, 'hi');
    await send(withCarol, CAROL, 'hey');

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.totalUnread).toBe(2);
  });

  it('should order conversations by most recent activity first', async () => {
    // Arrange
    const older = await open(ALICE, BOB);
    const newer = await open(ALICE, CAROL);
    older.recordActivity(Timestamp.fromISO('2026-01-01T00:00:00.000Z'));
    newer.recordActivity(Timestamp.fromISO('2026-06-01T00:00:00.000Z'));
    await conversationRepo.save(older);
    await conversationRepo.save(newer);

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items[0].id).toBe(newer.id.value);
  });

  it('should exclude conversations the viewer is not part of', async () => {
    // Arrange
    await open(BOB, CAROL);

    // Act
    const result = await handler.execute(new ListConversationsQuery(ALICE));

    // Assert
    expect(result.items).toEqual([]);
  });
});
