import { describe, it, expect } from 'vitest';
import {
  MESSAGE_CONTENT_MAX_LENGTH,
} from '@csn/domain-direct-messages';
import { DirectMessageMapper } from '../mappers/direct-message.mapper';
import { DirectMessageEntity } from '../entities/direct-message.entity';

const ALICE = '11111111-1111-4111-8111-111111111111';

function entity(overrides: Partial<DirectMessageEntity> = {}): DirectMessageEntity {
  const e = new DirectMessageEntity();
  e.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  e.conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  e.senderId = ALICE;
  e.content = 'hello there';
  e.createdAt = new Date('2026-03-01T12:00:00.000Z');
  e.readAt = null;
  e.version = 1;
  return Object.assign(e, overrides);
}

describe('DirectMessageMapper.toDomain', () => {
  it('should restore the message content', () => {
    // Act
    const message = new DirectMessageMapper().toDomain(entity());

    // Assert
    expect(message.content.value).toBe('hello there');
  });

  it('should restore the sender', () => {
    // Act
    const message = new DirectMessageMapper().toDomain(entity());

    // Assert
    expect(message.senderId.value).toBe(ALICE);
  });

  it('should map a null read_at to an unread message', () => {
    // Act
    const message = new DirectMessageMapper().toDomain(entity({ readAt: null }));

    // Assert
    expect(message.readAt).toBeNull();
  });

  it('should map a populated read_at to a read timestamp', () => {
    // Act
    const message = new DirectMessageMapper().toDomain(
      entity({ readAt: new Date('2026-03-02T00:00:00.000Z') }),
    );

    // Assert
    expect(message.readAt?.toISO()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('should restore a message of the maximum allowed length', () => {
    // Arrange
    const longBody = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH);

    // Act
    const message = new DirectMessageMapper().toDomain(entity({ content: longBody }));

    // Assert
    expect(message.content.length).toBe(MESSAGE_CONTENT_MAX_LENGTH);
  });
});

describe('DirectMessageMapper.toPersistence', () => {
  it('should write null into read_at for an unread message', () => {
    // Arrange
    const mapper = new DirectMessageMapper();
    const message = mapper.toDomain(entity({ readAt: null }));

    // Act
    const row = mapper.toPersistence(message);

    // Assert
    expect(row.readAt).toBeNull();
  });

  it('should round-trip a message without losing its content', () => {
    // Arrange
    const mapper = new DirectMessageMapper();
    const original = mapper.toDomain(entity());

    // Act
    const roundTripped = mapper.toDomain(mapper.toPersistence(original));

    // Assert
    expect(roundTripped.content.value).toBe(original.content.value);
  });

  it('should preserve the conversation the message belongs to', () => {
    // Arrange
    const mapper = new DirectMessageMapper();
    const message = mapper.toDomain(entity());

    // Act
    const row = mapper.toPersistence(message);

    // Assert
    expect(row.conversationId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});
