import { describe, it, expect } from 'vitest';
import { resolveReactionAction, applyReactionAction } from '../reaction-toggle';
import type { PublicationDto } from '../../../api/types';

function post(overrides: Partial<PublicationDto> = {}): PublicationDto {
  return {
    id: 'p1',
    authorId: 'a1',
    authorName: 'A',
    authorAvatarUrl: null,
    title: null,
    body: 'b',
    type: 'post',
    status: 'published',
    tags: [],
    reactionCount: 3,
    commentCount: 0,
    viewerReaction: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveReactionAction', () => {
  it('should add (+1) when the viewer has no reaction yet', () => {
    // Act
    const action = resolveReactionAction('p1', null, 'like');

    // Assert
    expect(action).toMatchObject({ remove: false, countDelta: 1, nextViewerReaction: 'like' });
  });

  it('should remove (-1) when the viewer clicks their current reaction', () => {
    // Act
    const action = resolveReactionAction('p1', 'like', 'like');

    // Assert
    expect(action).toMatchObject({ remove: true, countDelta: -1, nextViewerReaction: null });
  });

  it('should switch (0) when the viewer clicks a different reaction', () => {
    // Act
    const action = resolveReactionAction('p1', 'like', 'love');

    // Assert
    expect(action).toMatchObject({ remove: false, countDelta: 0, nextViewerReaction: 'love' });
  });

  it('should treat undefined current as "no reaction"', () => {
    // Act
    const action = resolveReactionAction('p1', undefined, 'wow');

    // Assert
    expect(action.countDelta).toBe(1);
  });

  it('should carry the clicked type for the API call even when removing', () => {
    // Act
    const action = resolveReactionAction('p1', 'sad', 'sad');

    // Assert
    expect(action.type).toBe('sad');
  });
});

describe('applyReactionAction', () => {
  it('should increase reactionCount and set viewerReaction on add', () => {
    // Arrange
    const action = resolveReactionAction('p1', null, 'like');

    // Act
    const out = applyReactionAction(post(), action);

    // Assert
    expect(out).toMatchObject({ reactionCount: 4, viewerReaction: 'like' });
  });

  it('should decrease reactionCount and clear viewerReaction on remove', () => {
    // Arrange
    const action = resolveReactionAction('p1', 'like', 'like');

    // Act
    const out = applyReactionAction(post({ viewerReaction: 'like' }), action);

    // Assert
    expect(out).toMatchObject({ reactionCount: 2, viewerReaction: null });
  });

  it('should never drive reactionCount below zero', () => {
    // Arrange
    const action = resolveReactionAction('p1', 'like', 'like');

    // Act
    const out = applyReactionAction(post({ reactionCount: 0, viewerReaction: 'like' }), action);

    // Assert
    expect(out.reactionCount).toBe(0);
  });

  it('should leave other posts untouched', () => {
    // Arrange
    const other = post({ id: 'p2' });
    const action = resolveReactionAction('p1', null, 'like');

    // Act
    const out = applyReactionAction(other, action);

    // Assert
    expect(out).toBe(other);
  });

  it('should not mutate the input post', () => {
    // Arrange
    const original = post();
    const action = resolveReactionAction('p1', null, 'like');

    // Act
    applyReactionAction(original, action);

    // Assert
    expect(original.reactionCount).toBe(3);
    expect(original.viewerReaction).toBeNull();
  });
});
