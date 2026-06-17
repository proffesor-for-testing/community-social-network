import { describe, it, expect } from 'vitest';
import { adaptComment } from '../queries';

function apiComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    postId: 'p1',
    authorId: 'a1',
    authorName: 'Alice C',
    content: 'cmt body',
    parentId: null,
    depth: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('comments adaptComment — authorName handling', () => {
  it('should use the API-provided authorName when present', () => {
    // Arrange
    const c = apiComment({ authorName: 'Alice C' });

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorName).toBe('Alice C');
  });

  it('should fall back to "Member" when authorName is missing', () => {
    // Arrange
    const c = apiComment();
    delete (c as Record<string, unknown>)['authorName'];

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should fall back to "Member" when authorName is empty', () => {
    // Arrange
    const c = apiComment({ authorName: '' });

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should fall back to "Member" when authorName is only whitespace', () => {
    // Arrange
    const c = apiComment({ authorName: '   \t' });

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should pass authorAvatarUrl through verbatim when present', () => {
    // Arrange
    const c = apiComment({ authorAvatarUrl: 'https://cdn.test/a.jpg' });

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorAvatarUrl).toBe('https://cdn.test/a.jpg');
  });

  it('should default authorAvatarUrl to null when missing', () => {
    // Arrange
    const c = apiComment();

    // Act
    const out = adaptComment(c);

    // Assert
    expect(out.authorAvatarUrl).toBeNull();
  });
});
