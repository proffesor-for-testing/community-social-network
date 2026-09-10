import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Conversation } from '../aggregates/conversation';
import { ConversationId } from '../value-objects/conversation-id';
import { ParticipantPair } from '../value-objects/participant-pair';
import { ConversationStartedEvent } from '../events/conversation-started.event';
import { NotAParticipantError } from '../errors/not-a-participant.error';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

function makeConversation(): Conversation {
  const pair = ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB));
  return Conversation.create(ConversationId.generate(), pair);
}

describe('Conversation.create', () => {
  it('should raise a ConversationStartedEvent', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const events = conversation.pullDomainEvents();

    // Assert
    expect(events[0]).toBeInstanceOf(ConversationStartedEvent);
  });

  it('should start at version 1', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const version = conversation.version;

    // Assert
    expect(version).toBe(1);
  });

  it('should hold both participants', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const hasBoth =
      conversation.hasParticipant(UserId.create(ALICE)) &&
      conversation.hasParticipant(UserId.create(BOB));

    // Assert
    expect(hasBoth).toBe(true);
  });
});

describe('Conversation participation', () => {
  it('should reject a member who is not in the pair', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const hasOutsider = conversation.hasParticipant(UserId.create(CAROL));

    // Assert
    expect(hasOutsider).toBe(false);
  });

  it('should throw when asserting participation for an outsider', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const act = () => conversation.assertParticipant(UserId.create(CAROL));

    // Assert
    expect(act).toThrow(NotAParticipantError);
  });

  it('should not throw when asserting participation for a participant', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const act = () => conversation.assertParticipant(UserId.create(BOB));

    // Assert
    expect(act).not.toThrow();
  });

  it('should return the counterpart participant', () => {
    // Arrange
    const conversation = makeConversation();

    // Act
    const other = conversation.otherParticipant(UserId.create(ALICE));

    // Assert
    expect(other.value).toBe(BOB);
  });
});

describe('Conversation.recordActivity', () => {
  it('should move the updatedAt clock forward', () => {
    // Arrange
    const conversation = makeConversation();
    const later = Timestamp.fromISO('2030-01-01T00:00:00.000Z');

    // Act
    conversation.recordActivity(later);

    // Assert
    expect(conversation.updatedAt.toISO()).toBe('2030-01-01T00:00:00.000Z');
  });

  it('should increment the aggregate version', () => {
    // Arrange
    const conversation = makeConversation();
    const before = conversation.version;

    // Act
    conversation.recordActivity();

    // Assert
    expect(conversation.version).toBe(before + 1);
  });

  it('should leave createdAt untouched', () => {
    // Arrange
    const conversation = makeConversation();
    const createdAt = conversation.createdAt.toISO();

    // Act
    conversation.recordActivity(Timestamp.fromISO('2030-01-01T00:00:00.000Z'));

    // Assert
    expect(conversation.createdAt.toISO()).toBe(createdAt);
  });
});

describe('Conversation.reconstitute', () => {
  it('should restore the persisted version without raising events', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB));

    // Act
    const conversation = Conversation.reconstitute(
      ConversationId.generate(),
      pair,
      Timestamp.now(),
      Timestamp.now(),
      7,
    );

    // Assert
    expect(conversation.pullDomainEvents()).toHaveLength(0);
  });

  it('should restore the persisted version number', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(ALICE), UserId.create(BOB));

    // Act
    const conversation = Conversation.reconstitute(
      ConversationId.generate(),
      pair,
      Timestamp.now(),
      Timestamp.now(),
      7,
    );

    // Assert
    expect(conversation.version).toBe(7);
  });
});
