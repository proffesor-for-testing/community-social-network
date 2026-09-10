import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

const { fetchGroupPublications, createGroupPublication, groupKeys } = await import(
  '../queries'
);

function apiPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    authorId: 'a1',
    authorName: 'Alice Author',
    content: 'group body',
    status: 'PUBLISHED',
    groupId: 'g1',
    reactionCounts: { LIKE: 2 },
    commentCount: 1,
    viewerReaction: 'LIKE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('fetchGroupPublications', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { items: [apiPost()], nextCursor: 'c2' } });
  });

  it('should call the group publications endpoint for the given group', async () => {
    // Act
    await fetchGroupPublications('g1');

    // Assert
    expect(get.mock.calls[0]![0]).toBe('/groups/g1/publications');
  });

  it('should request a page of twenty by default', async () => {
    // Act
    await fetchGroupPublications('g1');

    // Assert
    expect(get.mock.calls[0]![1]).toEqual({ params: { limit: '20' } });
  });

  it('should forward the cursor when one is supplied', async () => {
    // Act
    await fetchGroupPublications('g1', 'abc');

    // Assert
    expect(get.mock.calls[0]![1]).toEqual({ params: { limit: '20', cursor: 'abc' } });
  });

  it('should adapt items into the FE publication shape', async () => {
    // Act
    const page = await fetchGroupPublications('g1');

    // Assert
    expect(page.items[0]!.body).toBe('group body');
  });

  it('should keep the group id on adapted items', async () => {
    // Act
    const page = await fetchGroupPublications('g1');

    // Assert
    expect(page.items[0]!.groupId).toBe('g1');
  });

  it('should sum reaction counts for the card', async () => {
    // Act
    const page = await fetchGroupPublications('g1');

    // Assert
    expect(page.items[0]!.reactionCount).toBe(2);
  });

  it('should adapt the viewer reaction to the FE union', async () => {
    // Act
    const page = await fetchGroupPublications('g1');

    // Assert
    expect(page.items[0]!.viewerReaction).toBe('like');
  });

  it('should pass through the next cursor', async () => {
    // Act
    const page = await fetchGroupPublications('g1');

    // Assert
    expect(page.nextCursor).toBe('c2');
  });
});

describe('createGroupPublication', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { id: 'new-post' } });
  });

  it('should post the content to the group publications endpoint', async () => {
    // Act
    await createGroupPublication('g1', 'hello');

    // Assert
    expect(post.mock.calls[0]).toEqual(['/groups/g1/publications', { content: 'hello' }]);
  });

  it('should return the created publication id', async () => {
    // Act
    const result = await createGroupPublication('g1', 'hello');

    // Assert
    expect(result.id).toBe('new-post');
  });
});

describe('groupKeys.posts', () => {
  it('should namespace the group post cache key by group id', () => {
    // Act / Assert
    expect(groupKeys.posts('g1')).toEqual(['groups', 'g1', 'posts']);
  });
});
