import { describe, it, expect } from 'vitest';
import { adaptPost, adaptViewerReaction } from '../queries';

function apiPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    authorId: 'a1',
    authorName: 'Alice Author',
    content: 'body',
    status: 'PUBLISHED',
    reactionCounts: { LIKE: 2 },
    commentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('feed adaptPost — authorName handling', () => {
  it('should use the API-provided authorName when present', () => {
    // Arrange
    const p = apiPost({ authorName: 'Alice Author' });

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorName).toBe('Alice Author');
  });

  it('should fall back to "Member" when authorName is missing', () => {
    // Arrange
    const p = apiPost();
    delete (p as Record<string, unknown>)['authorName'];

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should fall back to "Member" when authorName is an empty string', () => {
    // Arrange
    const p = apiPost({ authorName: '' });

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should fall back to "Member" when authorName is only whitespace', () => {
    // Arrange
    const p = apiPost({ authorName: '   ' });

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorName).toBe('Member');
  });

  it('should pass authorAvatarUrl through verbatim when set', () => {
    // Arrange
    const p = apiPost({ authorAvatarUrl: 'https://cdn.test/a.png' });

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorAvatarUrl).toBe('https://cdn.test/a.png');
  });

  it('should default authorAvatarUrl to null when missing', () => {
    // Arrange
    const p = apiPost();

    // Act
    const out = adaptPost(p);

    // Assert
    expect(out.authorAvatarUrl).toBeNull();
  });
});

describe('feed adaptPost — viewerReaction handling', () => {
  it.each([
    ['LIKE', 'like'],
    ['LOVE', 'love'],
    ['HAHA', 'laugh'],
    ['WOW', 'wow'],
    ['SAD', 'sad'],
    ['ANGRY', 'angry'],
  ])('should map API %s to FE %s', (api, fe) => {
    // Act
    const out = adaptPost(apiPost({ viewerReaction: api }));

    // Assert
    expect(out.viewerReaction).toBe(fe);
  });

  it('should map null viewerReaction to null', () => {
    // Act
    const out = adaptPost(apiPost({ viewerReaction: null }));

    // Assert
    expect(out.viewerReaction).toBeNull();
  });

  it('should map a missing viewerReaction field to null', () => {
    // Act
    const out = adaptPost(apiPost());

    // Assert
    expect(out.viewerReaction).toBeNull();
  });

  it('should map an unknown enum value to null rather than throwing', () => {
    // Act
    const out = adaptViewerReaction('CONFUSED');

    // Assert
    expect(out).toBeNull();
  });
});
