import { describe, it, expect } from 'vitest';
import { adaptAlert } from '../queries';

function apiAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    recipientId: 'u1',
    type: 'FOLLOW',
    content: {
      title: 'CSN Admin accepted your follow request',
      body: 'CSN Admin accepted your follow request',
      actionUrl: '/profiles/abc',
    },
    status: 'UNREAD',
    createdAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

describe('notifications adaptAlert — actionUrl handling', () => {
  it('should pass actionUrl through from the API content block', () => {
    // Arrange
    const a = apiAlert();

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.actionUrl).toBe('/profiles/abc');
  });

  it('should default actionUrl to null when the API omits it', () => {
    // Arrange
    const a = apiAlert({ content: { title: 't', body: 'b' } });

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.actionUrl).toBeNull();
  });

  it('should default actionUrl to null when the content block is missing entirely', () => {
    // Arrange
    const a = apiAlert();
    delete (a as Record<string, unknown>)['content'];

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.actionUrl).toBeNull();
  });

  it('should lowercase the alert type so the icon switch matches', () => {
    // Arrange
    const a = apiAlert({ type: 'COMMENT' });

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.type).toBe('comment');
  });

  it('should mark the alert read when status is anything other than "UNREAD"', () => {
    // Arrange
    const a = apiAlert({ status: 'READ' });

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.isRead).toBe(true);
  });

  it('should keep the alert unread when status is exactly "UNREAD"', () => {
    // Arrange
    const a = apiAlert({ status: 'UNREAD' });

    // Act
    const out = adaptAlert(a);

    // Assert
    expect(out.isRead).toBe(false);
  });
});
