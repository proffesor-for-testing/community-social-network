import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
  },
}));

import { apiClient } from '../../../api/client';
import { promoteUser, demoteUser } from '../queries';

const post = apiClient.post as unknown as ReturnType<typeof vi.fn>;

describe('admin promote/demote queries', () => {
  beforeEach(() => {
    post.mockClear();
  });

  it('should POST to the promote endpoint for the given user', async () => {
    // Arrange
    const userId = 'user-uuid-1';

    // Act
    await promoteUser(userId);

    // Assert
    expect(post).toHaveBeenCalledWith('/admin/users/user-uuid-1/promote');
  });

  it('should POST to the demote endpoint for the given user', async () => {
    // Arrange
    const userId = 'user-uuid-1';

    // Act
    await demoteUser(userId);

    // Assert
    expect(post).toHaveBeenCalledWith('/admin/users/user-uuid-1/demote');
  });

  it('should send exactly one request when promoting', async () => {
    // Arrange
    const userId = 'user-uuid-2';

    // Act
    await promoteUser(userId);

    // Assert
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('should propagate a rejection from the API client', async () => {
    // Arrange
    post.mockRejectedValueOnce(new Error('network down'));

    // Act & Assert
    await expect(promoteUser('user-uuid-3')).rejects.toThrow('network down');
  });
});
