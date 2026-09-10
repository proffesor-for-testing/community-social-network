import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  ParticipantPair,
} from '@csn/domain-direct-messages';
import { ConversationMapper } from '../mappers/conversation.mapper';
import { ConversationEntity } from '../entities/conversation.entity';

const LOWER = '11111111-1111-4111-8111-111111111111';
const HIGHER = '99999999-9999-4999-8999-999999999999';

function entity(overrides: Partial<ConversationEntity> = {}): ConversationEntity {
  const e = new ConversationEntity();
  e.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  e.participantA = LOWER;
  e.participantB = HIGHER;
  e.createdAt = new Date('2026-01-01T00:00:00.000Z');
  e.updatedAt = new Date('2026-02-01T00:00:00.000Z');
  e.version = 3;
  return Object.assign(e, overrides);
}

describe('ConversationMapper.toDomain', () => {
  it('should restore the conversation id', () => {
    // Act
    const conversation = new ConversationMapper().toDomain(entity());

    // Assert
    expect(conversation.id.value).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('should restore both participants', () => {
    // Act
    const conversation = new ConversationMapper().toDomain(entity());

    // Assert
    expect(conversation.hasParticipant(UserId.create(HIGHER))).toBe(true);
  });

  it('should restore the persisted version', () => {
    // Act
    const conversation = new ConversationMapper().toDomain(entity());

    // Assert
    expect(conversation.version).toBe(3);
  });

  it('should restore the last-activity timestamp', () => {
    // Act
    const conversation = new ConversationMapper().toDomain(entity());

    // Assert
    expect(conversation.updatedAt.toISO()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('should not raise domain events when reconstituting', () => {
    // Act
    const conversation = new ConversationMapper().toDomain(entity());

    // Assert
    expect(conversation.pullDomainEvents()).toHaveLength(0);
  });
});

describe('ConversationMapper.toPersistence', () => {
  it('should write the canonically lower participant into participant_a', () => {
    // Arrange
    const conversation = Conversation.create(
      ConversationId.generate(),
      ParticipantPair.create(UserId.create(HIGHER), UserId.create(LOWER)),
    );

    // Act
    const row = new ConversationMapper().toPersistence(conversation);

    // Assert
    expect(row.participantA).toBe(LOWER);
  });

  it('should round-trip a conversation without losing its participants', () => {
    // Arrange
    const mapper = new ConversationMapper();
    const original = mapper.toDomain(entity());

    // Act
    const roundTripped = mapper.toDomain(mapper.toPersistence(original));

    // Assert
    expect(roundTripped.participants.equals(original.participants)).toBe(true);
  });
});
