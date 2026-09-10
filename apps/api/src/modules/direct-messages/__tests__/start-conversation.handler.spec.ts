import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { ParticipantPair } from '@csn/domain-direct-messages';
import { InMemoryConversationRepository } from '@csn/infra-direct-messages';
import { StartConversationHandler } from '../commands/start-conversation.handler';
import { StartConversationCommand } from '../commands/start-conversation.command';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

let conversationRepo: InMemoryConversationRepository;
let blockRepo: { isBlocked: ReturnType<typeof vi.fn> };
let profileRepo: { findByMemberId: ReturnType<typeof vi.fn> };
let handler: StartConversationHandler;

beforeEach(() => {
  conversationRepo = new InMemoryConversationRepository();
  blockRepo = { isBlocked: vi.fn().mockResolvedValue(false) };
  profileRepo = {
    findByMemberId: vi.fn().mockResolvedValue({ displayName: { value: 'Bob Builder' } }),
  };
  handler = new StartConversationHandler(
    conversationRepo,
    blockRepo as never,
    profileRepo as never,
  );
});

describe('StartConversationHandler', () => {
  it('should create a conversation for a new pair', async () => {
    // Act
    const result = await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    expect(result.id).toBeDefined();
  });

  it('should return the recipient as the other participant', async () => {
    // Act
    const result = await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    expect(result.otherParticipant.memberId).toBe(BOB);
  });

  it('should label the other participant with their display name', async () => {
    // Act
    const result = await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    expect(result.otherParticipant.displayName).toBe('Bob Builder');
  });

  it('should fall back to "Member" when the recipient has no profile', async () => {
    // Arrange
    profileRepo.findByMemberId.mockResolvedValue(null);

    // Act
    const result = await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    expect(result.otherParticipant.displayName).toBe('Member');
  });

  it('should reject a conversation with yourself', async () => {
    // Act
    const act = handler.execute(new StartConversationCommand(ALICE, ALICE));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should reject a conversation between a blocked pair', async () => {
    // Arrange
    blockRepo.isBlocked.mockResolvedValue(true);

    // Act
    const act = handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should not persist a conversation when the pair is blocked', async () => {
    // Arrange
    blockRepo.isBlocked.mockResolvedValue(true);

    // Act
    await handler.execute(new StartConversationCommand(ALICE, BOB)).catch(() => undefined);

    // Assert
    expect(conversationRepo.size).toBe(0);
  });

  it('should reuse the existing conversation when one already exists', async () => {
    // Arrange
    const existing = await conversationRepo.findOrCreate(
      ParticipantPair.create(UserId.create(BOB), UserId.create(ALICE)),
    );

    // Act
    const result = await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Assert
    expect(result.id).toBe(existing.id.value);
  });

  it('should not create a second conversation when the initiator is reversed', async () => {
    // Arrange
    await handler.execute(new StartConversationCommand(ALICE, BOB));

    // Act
    await handler.execute(new StartConversationCommand(BOB, ALICE));

    // Assert
    expect(conversationRepo.size).toBe(1);
  });
});
