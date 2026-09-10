import { describe, it, expect } from 'vitest';
import { FeedCursor } from '../value-objects/feed-cursor';

describe('FeedCursor', () => {
  const position = {
    createdAt: new Date('2026-03-04T05:06:07.008Z'),
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  it('should round-trip the createdAt of a position', () => {
    // Act
    const decoded = FeedCursor.decode(FeedCursor.encode(position));

    // Assert
    expect(decoded!.createdAt.toISOString()).toBe(position.createdAt.toISOString());
  });

  it('should round-trip the id of a position', () => {
    // Act
    const decoded = FeedCursor.decode(FeedCursor.encode(position));

    // Assert
    expect(decoded!.id).toBe(position.id);
  });

  it('should produce a URL-safe token', () => {
    // Act
    const token = FeedCursor.encode(position);

    // Assert
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should decode undefined as no position', () => {
    // Act / Assert
    expect(FeedCursor.decode(undefined)).toBeNull();
  });

  it('should decode an empty string as no position', () => {
    // Act / Assert
    expect(FeedCursor.decode('')).toBeNull();
  });

  it('should decode a token without a separator as no position', () => {
    // Arrange
    const token = Buffer.from('garbage', 'utf8').toString('base64url');

    // Act / Assert
    expect(FeedCursor.decode(token)).toBeNull();
  });

  it('should decode a token with an unparsable date as no position', () => {
    // Arrange
    const token = Buffer.from('not-a-date|some-id', 'utf8').toString('base64url');

    // Act / Assert
    expect(FeedCursor.decode(token)).toBeNull();
  });

  it('should decode a token with an empty id as no position', () => {
    // Arrange
    const token = Buffer.from('2026-01-01T00:00:00.000Z|', 'utf8').toString('base64url');

    // Act / Assert
    expect(FeedCursor.decode(token)).toBeNull();
  });
});
