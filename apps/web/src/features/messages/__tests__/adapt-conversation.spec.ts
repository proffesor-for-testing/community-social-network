import { describe, it, expect } from 'vitest';
import { adaptConversation, adaptMessage } from '../queries';

function apiMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    content: 'See you then',
    createdAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

function apiConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    otherParticipant: { memberId: 'u2', displayName: 'Bob Builder' },
    lastMessage: apiMessage(),
    unreadCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('messages adaptConversation — other participant', () => {
  it('should flatten the other participant id onto the row', () => {
    // Arrange
    const c = apiConversation();

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.otherMemberId).toBe('u2');
  });

  it('should use the API-provided display name', () => {
    // Arrange
    const c = apiConversation();

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.otherDisplayName).toBe('Bob Builder');
  });

  it('should fall back to "Member" when the display name is only whitespace', () => {
    // Arrange
    const c = apiConversation({ otherParticipant: { memberId: 'u2', displayName: '  ' } });

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.otherDisplayName).toBe('Member');
  });

  it('should fall back to "Member" when the participant block is missing', () => {
    // Arrange
    const c = apiConversation();
    delete (c as Record<string, unknown>)['otherParticipant'];

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.otherDisplayName).toBe('Member');
  });

  it('should default the other member id to an empty string when absent', () => {
    // Arrange
    const c = apiConversation();
    delete (c as Record<string, unknown>)['otherParticipant'];

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.otherMemberId).toBe('');
  });
});

describe('messages adaptConversation — preview and badge', () => {
  it('should carry the last message content through for the preview', () => {
    // Arrange
    const c = apiConversation();

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.lastMessage?.content).toBe('See you then');
  });

  it('should map a null last message to null rather than undefined', () => {
    // Arrange
    const c = apiConversation({ lastMessage: null });

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.lastMessage).toBeNull();
  });

  it('should map a missing last message to null', () => {
    // Arrange
    const c = apiConversation();
    delete (c as Record<string, unknown>)['lastMessage'];

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.lastMessage).toBeNull();
  });

  it('should pass the unread count through for the badge', () => {
    // Arrange
    const c = apiConversation({ unreadCount: 3 });

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.unreadCount).toBe(3);
  });

  it('should default the unread count to zero when the API omits it', () => {
    // Arrange
    const c = apiConversation();
    delete (c as Record<string, unknown>)['unreadCount'];

    // Act
    const out = adaptConversation(c);

    // Assert
    expect(out.unreadCount).toBe(0);
  });
});

describe('messages adaptMessage', () => {
  it('should keep the message body', () => {
    // Arrange
    const m = apiMessage();

    // Act
    const out = adaptMessage(m);

    // Assert
    expect(out.content).toBe('See you then');
  });

  it('should default a missing body to an empty string', () => {
    // Arrange
    const m = apiMessage();
    delete (m as Record<string, unknown>)['content'];

    // Act
    const out = adaptMessage(m);

    // Assert
    expect(out.content).toBe('');
  });

  it('should keep an unread message read timestamp null', () => {
    // Arrange
    const m = apiMessage({ readAt: null });

    // Act
    const out = adaptMessage(m);

    // Assert
    expect(out.readAt).toBeNull();
  });

  it('should pass a read timestamp through', () => {
    // Arrange
    const m = apiMessage({ readAt: '2026-01-03T00:00:00.000Z' });

    // Act
    const out = adaptMessage(m);

    // Assert
    expect(out.readAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('should keep the sender so the thread can side the bubble', () => {
    // Arrange
    const m = apiMessage({ senderId: 'u9' });

    // Act
    const out = adaptMessage(m);

    // Assert
    expect(out.senderId).toBe('u9');
  });
});
