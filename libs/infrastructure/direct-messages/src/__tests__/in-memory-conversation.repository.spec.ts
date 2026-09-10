import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { ParticipantPair, ConversationId } from '@csn/domain-direct-messages';
import { InMemoryConversationRepository } from '../repositories/in-memory-conversation.repository';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

function pairOf(a: string, b: string): ParticipantPair {
  return ParticipantPair.create(UserId.create(a), UserId.create(b));
}

describe('InMemoryConversationRepository.findOrCreate', () => {
  let repo: InMemoryConversationRepository;

  beforeEach(() => {
    repo = new InMemoryConversationRepository();
  });

  it('should create a conversation when the pair has none', async () => {
    // Act
    const conversation = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Assert
    expect(conversation.id.value).toBeDefined();
  });

  it('should persist the conversation it creates', async () => {
    // Act
    await repo.findOrCreate(pairOf(ALICE, BOB));

    // Assert
    expect(repo.size).toBe(1);
  });

  it('should return the same conversation on a second call', async () => {
    // Arrange
    const first = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    const second = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Assert
    expect(second.id.value).toBe(first.id.value);
  });

  it('should return the same conversation when the pair is given in reverse order', async () => {
    // Arrange
    const first = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    const reversed = await repo.findOrCreate(pairOf(BOB, ALICE));

    // Assert
    expect(reversed.id.value).toBe(first.id.value);
  });

  it('should not create a second row for a reversed pair', async () => {
    // Arrange
    await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    await repo.findOrCreate(pairOf(BOB, ALICE));

    // Assert
    expect(repo.size).toBe(1);
  });

  it('should create a separate conversation for a different pair', async () => {
    // Arrange
    await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    await repo.findOrCreate(pairOf(ALICE, CAROL));

    // Assert
    expect(repo.size).toBe(2);
  });
});

describe('InMemoryConversationRepository.findByParticipants', () => {
  let repo: InMemoryConversationRepository;

  beforeEach(() => {
    repo = new InMemoryConversationRepository();
  });

  it('should return null when no conversation exists for the pair', async () => {
    // Act
    const found = await repo.findByParticipants(pairOf(ALICE, BOB));

    // Assert
    expect(found).toBeNull();
  });

  it('should find a conversation stored under the reversed pair', async () => {
    // Arrange
    const created = await repo.findOrCreate(pairOf(BOB, ALICE));

    // Act
    const found = await repo.findByParticipants(pairOf(ALICE, BOB));

    // Assert
    expect(found?.id.value).toBe(created.id.value);
  });
});

describe('InMemoryConversationRepository.findByParticipant', () => {
  let repo: InMemoryConversationRepository;

  beforeEach(() => {
    repo = new InMemoryConversationRepository();
  });

  it('should return only the conversations the user takes part in', async () => {
    // Arrange
    await repo.findOrCreate(pairOf(ALICE, BOB));
    await repo.findOrCreate(pairOf(BOB, CAROL));

    // Act
    const conversations = await repo.findByParticipant(UserId.create(ALICE));

    // Assert
    expect(conversations).toHaveLength(1);
  });

  it('should order conversations by most recent activity first', async () => {
    // Arrange
    const older = await repo.findOrCreate(pairOf(ALICE, BOB));
    const newer = await repo.findOrCreate(pairOf(ALICE, CAROL));
    older.recordActivity(Timestamp.fromISO('2026-01-01T00:00:00.000Z'));
    newer.recordActivity(Timestamp.fromISO('2026-06-01T00:00:00.000Z'));
    await repo.save(older);
    await repo.save(newer);

    // Act
    const conversations = await repo.findByParticipant(UserId.create(ALICE));

    // Assert
    expect(conversations[0].id.value).toBe(newer.id.value);
  });

  it('should return an empty list for a user with no conversations', async () => {
    // Act
    const conversations = await repo.findByParticipant(UserId.create(CAROL));

    // Assert
    expect(conversations).toEqual([]);
  });
});

describe('InMemoryConversationRepository basics', () => {
  it('should return null for an unknown id', async () => {
    // Arrange
    const repo = new InMemoryConversationRepository();

    // Act
    const found = await repo.findById(ConversationId.generate());

    // Assert
    expect(found).toBeNull();
  });

  it('should report a stored conversation as existing', async () => {
    // Arrange
    const repo = new InMemoryConversationRepository();
    const conversation = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    const exists = await repo.exists(conversation.id);

    // Assert
    expect(exists).toBe(true);
  });

  it('should remove a deleted conversation', async () => {
    // Arrange
    const repo = new InMemoryConversationRepository();
    const conversation = await repo.findOrCreate(pairOf(ALICE, BOB));

    // Act
    await repo.delete(conversation);

    // Assert
    expect(repo.size).toBe(0);
  });
});
