import { describe, it, expect } from 'vitest';
import { connectionToProfile } from '../queries';

const viewer = 'viewer-id';
const otherFollower = 'other-follower-id';
const otherFollowee = 'other-followee-id';

function apiFollowerConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    followerId: otherFollower,
    followerName: 'Other Follower',
    followerAvatarUrl: null,
    followeeId: viewer,
    followeeName: 'You',
    followeeAvatarUrl: null,
    status: 'accepted',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function apiFollowingConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c2',
    followerId: viewer,
    followerName: 'You',
    followerAvatarUrl: null,
    followeeId: otherFollowee,
    followeeName: 'Other Followee',
    followeeAvatarUrl: null,
    status: 'accepted',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('social connectionToProfile — display name from the other side', () => {
  it('should pick the follower name when the viewer is the followee (followers list)', () => {
    // Arrange
    const c = apiFollowerConnection();

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.displayName).toBe('Other Follower');
  });

  it('should pick the followee name when the viewer is the follower (following list)', () => {
    // Arrange
    const c = apiFollowingConnection();

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.displayName).toBe('Other Followee');
  });

  it('should fall back to "Member" when the other side has no name', () => {
    // Arrange
    const c = apiFollowerConnection({ followerName: undefined });

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.displayName).toBe('Member');
  });

  it('should fall back to "Member" when the other side name is whitespace only', () => {
    // Arrange
    const c = apiFollowerConnection({ followerName: '   ' });

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.displayName).toBe('Member');
  });

  it('should pass through avatarUrl from the other side when present', () => {
    // Arrange
    const c = apiFollowerConnection({ followerAvatarUrl: 'https://cdn.test/avatar.png' });

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.avatarUrl).toBe('https://cdn.test/avatar.png');
  });

  it('should expose the other side memberId so caller links to the right profile', () => {
    // Arrange
    const c = apiFollowerConnection();

    // Act
    const out = connectionToProfile(c, viewer);

    // Assert
    expect(out.memberId).toBe(otherFollower);
  });
});
