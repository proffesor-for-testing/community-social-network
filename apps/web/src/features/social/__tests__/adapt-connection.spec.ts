import { describe, it, expect } from 'vitest';
import { adaptConnection } from '../queries';

function apiConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    followerId: 'follower-1',
    followerName: 'Follower Name',
    followerAvatarUrl: null,
    followeeId: 'followee-1',
    followeeName: 'Followee Name',
    followeeAvatarUrl: null,
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('social adaptConnection — name passthrough', () => {
  it('should expose requesterName from the API followerName', () => {
    // Arrange
    const c = apiConnection({ followerName: 'Alice F' });

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.requesterName).toBe('Alice F');
  });

  it('should expose addresseeName from the API followeeName', () => {
    // Arrange
    const c = apiConnection({ followeeName: 'Bob F' });

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.addresseeName).toBe('Bob F');
  });

  it('should leave requesterName undefined when the API omits followerName', () => {
    // Arrange
    const c = apiConnection();
    delete (c as Record<string, unknown>)['followerName'];

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.requesterName).toBeUndefined();
  });

  it('should lowercase the connection status into the FE union', () => {
    // Arrange
    const c = apiConnection({ status: 'ACCEPTED' });

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.status).toBe('accepted');
  });

  it('should derive requesterId from followerId when the legacy alias is absent', () => {
    // Arrange
    const c = apiConnection({ followerId: 'fid-9' });

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.requesterId).toBe('fid-9');
  });

  it('should default requesterAvatarUrl to null when missing', () => {
    // Arrange
    const c = apiConnection();
    delete (c as Record<string, unknown>)['followerAvatarUrl'];

    // Act
    const out = adaptConnection(c);

    // Assert
    expect(out.requesterAvatarUrl).toBeNull();
  });
});
