import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatTimeAgo } from '../format-time';

const NOW = new Date('2026-06-15T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('messages formatTimeAgo', () => {
  it('should read "just now" for a message seconds old', () => {
    // Arrange
    const when = '2026-06-15T11:59:30.000Z';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe('just now');
  });

  it('should report whole minutes under an hour', () => {
    // Arrange
    const when = '2026-06-15T11:35:00.000Z';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe('25m ago');
  });

  it('should report whole hours under a day', () => {
    // Arrange
    const when = '2026-06-15T09:00:00.000Z';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe('3h ago');
  });

  it('should report whole days under a week', () => {
    // Arrange
    const when = '2026-06-13T12:00:00.000Z';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe('2d ago');
  });

  it('should fall back to a date beyond a week', () => {
    // Arrange
    const when = '2026-05-01T12:00:00.000Z';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe(new Date(when).toLocaleDateString());
  });

  it('should return an empty string for an unparseable timestamp', () => {
    // Arrange
    const when = 'not-a-date';

    // Act
    const out = formatTimeAgo(when);

    // Assert
    expect(out).toBe('');
  });
});
