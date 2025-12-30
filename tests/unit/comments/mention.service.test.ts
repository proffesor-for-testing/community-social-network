/**
 * MentionService Unit Tests
 * TDD London School - Behavior Verification with Mocks
 *
 * Tests @mention extraction and notification triggering
 */

import { MentionService } from '../../../src/comments/mention.service';
import { MAX_MENTIONS_PER_COMMENT } from '../../../src/comments/comment.types';

// ============================================================================
// MOCK SETUP
// ============================================================================

interface MockUserRepository {
  findByUsernames: jest.Mock;
}

interface MockMentionRepository {
  createBatch: jest.Mock;
  findByCommentId: jest.Mock;
}

interface MockNotificationService {
  notifyMention: jest.Mock;
}

const createMockUserRepository = (): MockUserRepository => ({
  findByUsernames: jest.fn()
});

const createMockMentionRepository = (): MockMentionRepository => ({
  createBatch: jest.fn(),
  findByCommentId: jest.fn()
});

const createMockNotificationService = (): MockNotificationService => ({
  notifyMention: jest.fn()
});

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  ...overrides
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('MentionService', () => {
  let mentionService: MentionService;
  let mockUserRepository: MockUserRepository;
  let mockMentionRepository: MockMentionRepository;
  let mockNotificationService: MockNotificationService;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockMentionRepository = createMockMentionRepository();
    mockNotificationService = createMockNotificationService();

    mentionService = new MentionService(
      mockUserRepository as any,
      mockMentionRepository as any,
      mockNotificationService as any
    );
  });

  // ==========================================================================
  // EXTRACT MENTIONS TESTS
  // ==========================================================================

  describe('extractMentions', () => {
    it('should extract single @mention from content', () => {
      // Arrange
      const content = 'Hey @johndoe check this out!';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['johndoe']);
    });

    it('should extract multiple @mentions from content', () => {
      // Arrange
      const content = 'Great work @alice and @bob! Also @charlie should see this.';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should return empty array when no mentions present', () => {
      // Arrange
      const content = 'This is a regular comment without any mentions.';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle @mention at start of content', () => {
      // Arrange
      const content = '@johndoe you should see this';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['johndoe']);
    });

    it('should handle @mention at end of content', () => {
      // Arrange
      const content = 'Check this out @johndoe';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['johndoe']);
    });

    it('should extract unique mentions only (deduplicate)', () => {
      // Arrange
      const content = '@johndoe mentioned @johndoe again and @johndoe once more';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['johndoe']);
    });

    it('should handle mentions with underscores', () => {
      // Arrange
      const content = 'Hey @john_doe_123 check this out!';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['john_doe_123']);
    });

    it('should handle mentions with numbers', () => {
      // Arrange
      const content = 'Calling @user123 and @test456';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['user123', 'test456']);
    });

    it('should not extract invalid usernames (too short)', () => {
      // Arrange
      const content = 'Hey @ab this is invalid'; // Username must be 3+ chars

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual([]);
    });

    it('should not extract invalid usernames (special characters)', () => {
      // Arrange - These patterns have special chars attached to the username
      const content = 'Hey user-name@domain and test.name@mail are invalid mentions';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert - Emails and hyphenated words should not be extracted
      expect(result).toEqual([]);
    });

    it('should not extract email addresses as mentions', () => {
      // Arrange
      const content = 'Contact me at user@example.com';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual([]);
    });

    it('should limit to maximum 10 mentions', () => {
      // Arrange
      const mentions = Array.from({ length: 15 }, (_, i) => `@user${i + 1}`);
      const content = mentions.join(' ');

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result.length).toBe(MAX_MENTIONS_PER_COMMENT);
      expect(result).toEqual([
        'user1', 'user2', 'user3', 'user4', 'user5',
        'user6', 'user7', 'user8', 'user9', 'user10'
      ]);
    });

    it('should handle empty content', () => {
      // Arrange
      const content = '';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle content with only @ symbol', () => {
      // Arrange
      const content = 'Hello @ everyone';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle mentions in multiline content', () => {
      // Arrange
      const content = `Line 1 @user1
Line 2 @user2
Line 3 @user3`;

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['user1', 'user2', 'user3']);
    });
  });

  // ==========================================================================
  // VALIDATE MENTIONS TESTS
  // ==========================================================================

  describe('validateMentions', () => {
    it('should return valid users that exist in database', async () => {
      // Arrange
      const usernames = ['johndoe', 'janedoe'];
      const existingUsers = [
        createTestUser({ id: 'user-1', username: 'johndoe' }),
        createTestUser({ id: 'user-2', username: 'janedoe' })
      ];

      mockUserRepository.findByUsernames.mockResolvedValue(existingUsers);

      // Act
      const result = await mentionService.validateMentions(usernames);

      // Assert
      expect(mockUserRepository.findByUsernames).toHaveBeenCalledWith(usernames);
      expect(result).toEqual([
        { userId: 'user-1', username: 'johndoe' },
        { userId: 'user-2', username: 'janedoe' }
      ]);
    });

    it('should filter out non-existent users', async () => {
      // Arrange
      const usernames = ['existinguser', 'nonexistentuser'];
      const existingUsers = [
        createTestUser({ id: 'user-1', username: 'existinguser' })
      ];

      mockUserRepository.findByUsernames.mockResolvedValue(existingUsers);

      // Act
      const result = await mentionService.validateMentions(usernames);

      // Assert
      expect(result).toEqual([
        { userId: 'user-1', username: 'existinguser' }
      ]);
    });

    it('should return empty array when no users exist', async () => {
      // Arrange
      const usernames = ['nonexistent1', 'nonexistent2'];

      mockUserRepository.findByUsernames.mockResolvedValue([]);

      // Act
      const result = await mentionService.validateMentions(usernames);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array for empty input', async () => {
      // Arrange
      const usernames: string[] = [];

      // Act
      const result = await mentionService.validateMentions(usernames);

      // Assert
      expect(mockUserRepository.findByUsernames).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // CREATE MENTIONS TESTS
  // ==========================================================================

  describe('createMentions', () => {
    it('should create mention records for all valid mentions', async () => {
      // Arrange
      const commentId = 'comment-123';
      const mentions = [
        { userId: 'user-1', username: 'johndoe' },
        { userId: 'user-2', username: 'janedoe' }
      ];

      const createdMentions = mentions.map((m, index) => ({
        id: `mention-${index}`,
        commentId,
        mentionedUserId: m.userId,
        createdAt: new Date()
      }));

      mockMentionRepository.createBatch.mockResolvedValue(createdMentions);

      // Act
      const result = await mentionService.createMentions(commentId, mentions);

      // Assert
      expect(mockMentionRepository.createBatch).toHaveBeenCalledWith(
        commentId,
        mentions.map(m => m.userId)
      );
      expect(result).toEqual(mentions);
    });

    it('should trigger notifications for each mention', async () => {
      // Arrange
      const commentId = 'comment-123';
      const authorId = 'author-123';
      const postId = 'post-123';
      const mentions = [
        { userId: 'user-1', username: 'johndoe' },
        { userId: 'user-2', username: 'janedoe' }
      ];

      mockMentionRepository.createBatch.mockResolvedValue([]);

      // Act
      await mentionService.createMentions(commentId, mentions, {
        authorId,
        postId,
        notify: true
      });

      // Assert
      expect(mockNotificationService.notifyMention).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.notifyMention).toHaveBeenCalledWith({
        mentionedUserId: 'user-1',
        commentId,
        authorId,
        postId
      });
      expect(mockNotificationService.notifyMention).toHaveBeenCalledWith({
        mentionedUserId: 'user-2',
        commentId,
        authorId,
        postId
      });
    });

    it('should not create mentions when list is empty', async () => {
      // Arrange
      const commentId = 'comment-123';
      const mentions: { userId: string; username: string }[] = [];

      // Act
      const result = await mentionService.createMentions(commentId, mentions);

      // Assert
      expect(mockMentionRepository.createBatch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should not notify the author if mentioned in their own comment', async () => {
      // Arrange
      const commentId = 'comment-123';
      const authorId = 'author-123';
      const mentions = [
        { userId: 'author-123', username: 'author' }, // Author mentioning themselves
        { userId: 'user-1', username: 'johndoe' }
      ];

      mockMentionRepository.createBatch.mockResolvedValue([]);

      // Act
      await mentionService.createMentions(commentId, mentions, {
        authorId,
        postId: 'post-123',
        notify: true
      });

      // Assert - Should only notify johndoe, not the author
      expect(mockNotificationService.notifyMention).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.notifyMention).toHaveBeenCalledWith(
        expect.objectContaining({ mentionedUserId: 'user-1' })
      );
    });
  });

  // ==========================================================================
  // GET MENTIONS BY COMMENT TESTS
  // ==========================================================================

  describe('getMentionsByComment', () => {
    it('should return all mentions for a comment', async () => {
      // Arrange
      const commentId = 'comment-123';
      const storedMentions = [
        { id: 'mention-1', commentId, mentionedUserId: 'user-1', username: 'johndoe' },
        { id: 'mention-2', commentId, mentionedUserId: 'user-2', username: 'janedoe' }
      ];

      mockMentionRepository.findByCommentId.mockResolvedValue(storedMentions);

      // Act
      const result = await mentionService.getMentionsByComment(commentId);

      // Assert
      expect(mockMentionRepository.findByCommentId).toHaveBeenCalledWith(commentId);
      expect(result).toEqual([
        { userId: 'user-1', username: 'johndoe' },
        { userId: 'user-2', username: 'janedoe' }
      ]);
    });

    it('should return empty array when no mentions exist', async () => {
      // Arrange
      const commentId = 'comment-no-mentions';

      mockMentionRepository.findByCommentId.mockResolvedValue([]);

      // Act
      const result = await mentionService.getMentionsByComment(commentId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle concurrent mention creation', async () => {
      // Arrange
      const commentId = 'comment-123';
      const mentions = [
        { userId: 'user-1', username: 'johndoe' }
      ];

      // Simulate duplicate key error (mention already exists)
      mockMentionRepository.createBatch.mockRejectedValueOnce(
        new Error('Unique constraint violation')
      );

      // Act & Assert
      await expect(
        mentionService.createMentions(commentId, mentions)
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should handle very long usernames in content', () => {
      // Arrange
      const longUsername = 'a'.repeat(100);
      const content = `@${longUsername} check this`;

      // Act
      const result = mentionService.extractMentions(content);

      // Assert - Username should be truncated to max 20 chars
      expect(result).toEqual([]);
    });

    it('should handle special unicode characters around mentions', () => {
      // Arrange
      const content = 'Hello @johndoe! Nice work! @janedoe.';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert
      expect(result).toEqual(['johndoe', 'janedoe']);
    });

    it('should case-insensitively deduplicate mentions', () => {
      // Arrange
      const content = '@JohnDoe and @johndoe and @JOHNDOE';

      // Act
      const result = mentionService.extractMentions(content);

      // Assert - Should keep first occurrence, dedupe case-insensitively
      expect(result.length).toBe(1);
    });
  });
});
