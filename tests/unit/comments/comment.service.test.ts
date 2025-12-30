/**
 * CommentService Unit Tests
 * TDD London School - Behavior Verification with Mocks
 *
 * Tests comment CRUD operations with materialized path pattern
 * Following architecture specification from m4-comments-architecture.md
 */

import { CommentService } from '../../../src/comments/comment.service';
import { MentionService } from '../../../src/comments/mention.service';
import {
  Comment,
  CreateCommentDTO,
  UpdateCommentDTO,
  CommentTreeNode,
  DeletedBy,
  MAX_COMMENT_DEPTH,
  EDIT_WINDOW_MINUTES
} from '../../../src/comments/comment.types';

// ============================================================================
// MOCK SETUP - London School TDD
// ============================================================================

// Mock repository interface
interface MockCommentRepository {
  findById: jest.Mock;
  findByPostId: jest.Mock;
  findTreeByPostId: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  softDelete: jest.Mock;
  hardDelete: jest.Mock;
  incrementRepliesCount: jest.Mock;
  decrementRepliesCount: jest.Mock;
  countReplies: jest.Mock;
}

interface MockPostRepository {
  findById: jest.Mock;
  incrementCommentsCount: jest.Mock;
  decrementCommentsCount: jest.Mock;
}

interface MockNotificationService {
  notifyCommentCreated: jest.Mock;
  notifyMention: jest.Mock;
}

// Factory for creating mock repositories
const createMockCommentRepository = (): MockCommentRepository => ({
  findById: jest.fn(),
  findByPostId: jest.fn(),
  findTreeByPostId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  hardDelete: jest.fn(),
  incrementRepliesCount: jest.fn(),
  decrementRepliesCount: jest.fn(),
  countReplies: jest.fn()
});

const createMockPostRepository = (): MockPostRepository => ({
  findById: jest.fn(),
  incrementCommentsCount: jest.fn(),
  decrementCommentsCount: jest.fn()
});

const createMockNotificationService = (): MockNotificationService => ({
  notifyCommentCreated: jest.fn(),
  notifyMention: jest.fn()
});

const createMockMentionService = (): jest.Mocked<MentionService> => ({
  extractMentions: jest.fn(),
  validateMentions: jest.fn(),
  createMentions: jest.fn()
} as unknown as jest.Mocked<MentionService>);

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const createTestPost = (overrides = {}) => ({
  id: 'post-123',
  authorId: 'user-456',
  content: 'Test post content',
  isDeleted: false,
  ...overrides
});

const createTestComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'comment-123',
  postId: 'post-123',
  authorId: 'user-789',
  parentCommentId: null,
  content: 'Test comment content',
  path: 'comment-123',
  depth: 0,
  likesCount: 0,
  repliesCount: 0,
  isDeleted: false,
  deletedBy: null,
  editedAt: null,
  createdAt: new Date('2025-01-01T12:00:00Z'),
  updatedAt: new Date('2025-01-01T12:00:00Z'),
  ...overrides
});

const createTestUser = (overrides = {}) => ({
  id: 'user-789',
  username: 'testuser',
  role: 'USER',
  ...overrides
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('CommentService', () => {
  let commentService: CommentService;
  let mockCommentRepository: MockCommentRepository;
  let mockPostRepository: MockPostRepository;
  let mockNotificationService: MockNotificationService;
  let mockMentionService: jest.Mocked<MentionService>;

  beforeEach(() => {
    mockCommentRepository = createMockCommentRepository();
    mockPostRepository = createMockPostRepository();
    mockNotificationService = createMockNotificationService();
    mockMentionService = createMockMentionService();

    commentService = new CommentService(
      mockCommentRepository as any,
      mockPostRepository as any,
      mockMentionService,
      mockNotificationService as any
    );
  });

  // ==========================================================================
  // CREATE COMMENT TESTS
  // ==========================================================================

  describe('createComment', () => {
    describe('when creating a top-level comment on a valid post', () => {
      it('should create comment successfully with depth 0 and path equal to comment id', async () => {
        // Arrange
        const post = createTestPost();
        const user = createTestUser();
        const createDTO: CreateCommentDTO = {
          postId: post.id,
          content: 'Great post!'
        };

        const expectedComment = createTestComment({
          id: 'new-comment-id',
          postId: post.id,
          authorId: user.id,
          content: createDTO.content,
          depth: 0,
          path: 'new-comment-id'
        });

        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.create.mockResolvedValue(expectedComment);
        mockMentionService.extractMentions.mockReturnValue([]);
        mockPostRepository.incrementCommentsCount.mockResolvedValue(undefined);

        // Act
        const result = await commentService.createComment(createDTO, user.id);

        // Assert - Behavior Verification (London School)
        expect(mockPostRepository.findById).toHaveBeenCalledWith(post.id);
        expect(mockCommentRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            postId: post.id,
            authorId: user.id,
            content: createDTO.content,
            depth: 0,
            parentCommentId: null
          })
        );
        expect(mockPostRepository.incrementCommentsCount).toHaveBeenCalledWith(post.id);
        expect(result.depth).toBe(0);
        expect(result.path).toBe('new-comment-id');
      });

      it('should extract mentions and trigger notifications', async () => {
        // Arrange
        const post = createTestPost();
        const user = createTestUser();
        const createDTO: CreateCommentDTO = {
          postId: post.id,
          content: 'Hey @johndoe and @janedoe check this out!'
        };

        const mentions = [
          { userId: 'user-john', username: 'johndoe' },
          { userId: 'user-jane', username: 'janedoe' }
        ];

        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.create.mockResolvedValue(createTestComment({ content: createDTO.content }));
        mockMentionService.extractMentions.mockReturnValue(['johndoe', 'janedoe']);
        mockMentionService.validateMentions.mockResolvedValue(mentions);
        mockMentionService.createMentions.mockResolvedValue(mentions);

        // Act
        await commentService.createComment(createDTO, user.id);

        // Assert - Verify mention extraction and notification
        expect(mockMentionService.extractMentions).toHaveBeenCalledWith(createDTO.content);
        expect(mockMentionService.validateMentions).toHaveBeenCalledWith(['johndoe', 'janedoe']);
        expect(mockNotificationService.notifyMention).toHaveBeenCalledTimes(2);
      });
    });

    describe('when creating a reply (nested comment)', () => {
      it('should create reply with depth = parent.depth + 1 when parent depth is 0', async () => {
        // Arrange
        const post = createTestPost();
        const user = createTestUser();
        const parentComment = createTestComment({
          id: 'parent-comment',
          depth: 0,
          path: 'parent-comment'
        });

        const createDTO: CreateCommentDTO = {
          postId: post.id,
          content: 'Reply to your comment',
          parentCommentId: parentComment.id
        };

        const expectedReply = createTestComment({
          id: 'reply-comment',
          parentCommentId: parentComment.id,
          depth: 1,
          path: 'parent-comment/reply-comment'
        });

        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.findById.mockResolvedValue(parentComment);
        mockCommentRepository.create.mockResolvedValue(expectedReply);
        mockMentionService.extractMentions.mockReturnValue([]);

        // Act
        const result = await commentService.createComment(createDTO, user.id);

        // Assert
        expect(mockCommentRepository.findById).toHaveBeenCalledWith(parentComment.id);
        expect(result.depth).toBe(1);
        expect(result.path).toBe('parent-comment/reply-comment');
        expect(mockCommentRepository.incrementRepliesCount).toHaveBeenCalledWith(parentComment.id);
      });

      it('should create reply at depth 2 when parent is at depth 1', async () => {
        // Arrange
        const post = createTestPost();
        const user = createTestUser();
        const parentComment = createTestComment({
          id: 'level1-comment',
          depth: 1,
          path: 'root-comment/level1-comment'
        });

        const createDTO: CreateCommentDTO = {
          postId: post.id,
          content: 'Second level reply',
          parentCommentId: parentComment.id
        };

        const expectedReply = createTestComment({
          id: 'level2-comment',
          parentCommentId: parentComment.id,
          depth: 2,
          path: 'root-comment/level1-comment/level2-comment'
        });

        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.findById.mockResolvedValue(parentComment);
        mockCommentRepository.create.mockResolvedValue(expectedReply);
        mockMentionService.extractMentions.mockReturnValue([]);

        // Act
        const result = await commentService.createComment(createDTO, user.id);

        // Assert
        expect(result.depth).toBe(2);
      });

      it('should reject reply when parent is at max depth (3 levels exceeded)', async () => {
        // Arrange
        const post = createTestPost();
        const user = createTestUser();
        const parentComment = createTestComment({
          id: 'level2-comment',
          depth: 2, // Max depth - cannot reply to this
          path: 'root/level1/level2-comment'
        });

        const createDTO: CreateCommentDTO = {
          postId: post.id,
          content: 'Third level reply - should fail',
          parentCommentId: parentComment.id
        };

        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.findById.mockResolvedValue(parentComment);

        // Act & Assert
        await expect(commentService.createComment(createDTO, user.id))
          .rejects.toThrow('Maximum comment depth exceeded. Comments can only be nested 3 levels deep.');

        expect(mockCommentRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('when post does not exist', () => {
      it('should throw error when post not found', async () => {
        // Arrange
        const user = createTestUser();
        const createDTO: CreateCommentDTO = {
          postId: 'non-existent-post',
          content: 'Comment on missing post'
        };

        mockPostRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(commentService.createComment(createDTO, user.id))
          .rejects.toThrow('Post not found');

        expect(mockCommentRepository.create).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // EDIT COMMENT TESTS
  // ==========================================================================

  describe('updateComment', () => {
    describe('when editing within 5 minute window', () => {
      it('should update comment successfully', async () => {
        // Arrange
        const user = createTestUser();
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

        const existingComment = createTestComment({
          id: 'comment-to-edit',
          authorId: user.id,
          createdAt: twoMinutesAgo
        });

        const updateDTO: UpdateCommentDTO = {
          content: 'Updated content'
        };

        const updatedComment = {
          ...existingComment,
          content: updateDTO.content,
          editedAt: now
        };

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockCommentRepository.update.mockResolvedValue(updatedComment);

        // Act
        const result = await commentService.updateComment(
          existingComment.id,
          updateDTO,
          user.id
        );

        // Assert
        expect(mockCommentRepository.findById).toHaveBeenCalledWith(existingComment.id);
        expect(mockCommentRepository.update).toHaveBeenCalledWith(
          existingComment.id,
          expect.objectContaining({
            content: updateDTO.content,
            editedAt: expect.any(Date)
          })
        );
        expect(result.content).toBe(updateDTO.content);
        expect(result.editedAt).not.toBeNull();
      });
    });

    describe('when editing after 5 minute window', () => {
      it('should reject edit when window has expired', async () => {
        // Arrange
        const user = createTestUser();
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

        const existingComment = createTestComment({
          id: 'old-comment',
          authorId: user.id,
          createdAt: tenMinutesAgo
        });

        const updateDTO: UpdateCommentDTO = {
          content: 'Trying to edit old comment'
        };

        mockCommentRepository.findById.mockResolvedValue(existingComment);

        // Act & Assert
        await expect(commentService.updateComment(existingComment.id, updateDTO, user.id))
          .rejects.toThrow(`Edit window has expired. Comments can only be edited within ${EDIT_WINDOW_MINUTES} minutes of creation.`);

        expect(mockCommentRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('when user is not the author', () => {
      it('should reject edit by non-author', async () => {
        // Arrange
        const commentAuthor = createTestUser({ id: 'author-id' });
        const otherUser = createTestUser({ id: 'other-user-id' });
        const now = new Date();

        const existingComment = createTestComment({
          id: 'comment-123',
          authorId: commentAuthor.id,
          createdAt: now
        });

        const updateDTO: UpdateCommentDTO = {
          content: 'Trying to edit someone else comment'
        };

        mockCommentRepository.findById.mockResolvedValue(existingComment);

        // Act & Assert
        await expect(commentService.updateComment(existingComment.id, updateDTO, otherUser.id))
          .rejects.toThrow('Only the comment author can edit this comment');

        expect(mockCommentRepository.update).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // DELETE COMMENT TESTS
  // ==========================================================================

  describe('deleteComment', () => {
    describe('when deleting comment with replies (soft delete)', () => {
      it('should soft delete and replace content with [deleted]', async () => {
        // Arrange
        const user = createTestUser();
        const existingComment = createTestComment({
          id: 'comment-with-replies',
          authorId: user.id,
          repliesCount: 3
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockCommentRepository.countReplies.mockResolvedValue(3);
        mockCommentRepository.softDelete.mockResolvedValue({
          ...existingComment,
          isDeleted: true,
          deletedBy: DeletedBy.AUTHOR,
          content: '[deleted]'
        });

        // Act
        const result = await commentService.deleteComment(existingComment.id, user.id);

        // Assert
        expect(mockCommentRepository.softDelete).toHaveBeenCalledWith(
          existingComment.id,
          DeletedBy.AUTHOR
        );
        expect(mockCommentRepository.hardDelete).not.toHaveBeenCalled();
        expect(result.deletedBy).toBe(DeletedBy.AUTHOR);
      });

      it('should preserve tree structure when soft deleting', async () => {
        // Arrange
        const user = createTestUser();
        const existingComment = createTestComment({
          id: 'parent-comment',
          authorId: user.id,
          repliesCount: 2
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockCommentRepository.countReplies.mockResolvedValue(2);
        mockCommentRepository.softDelete.mockResolvedValue({
          ...existingComment,
          isDeleted: true,
          deletedBy: DeletedBy.AUTHOR,
          content: '[deleted]'
        });

        // Act
        await commentService.deleteComment(existingComment.id, user.id);

        // Assert - Tree structure preserved (no cascading deletes)
        expect(mockCommentRepository.softDelete).toHaveBeenCalled();
        expect(mockCommentRepository.hardDelete).not.toHaveBeenCalled();
      });
    });

    describe('when deleting comment without replies (hard delete)', () => {
      it('should hard delete when no replies exist', async () => {
        // Arrange
        const user = createTestUser();
        const existingComment = createTestComment({
          id: 'leaf-comment',
          authorId: user.id,
          repliesCount: 0,
          parentCommentId: 'parent-123'
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockCommentRepository.countReplies.mockResolvedValue(0);
        mockCommentRepository.hardDelete.mockResolvedValue(undefined);

        // Act
        const result = await commentService.deleteComment(existingComment.id, user.id);

        // Assert
        expect(mockCommentRepository.hardDelete).toHaveBeenCalledWith(existingComment.id);
        expect(mockCommentRepository.softDelete).not.toHaveBeenCalled();
        expect(mockCommentRepository.decrementRepliesCount).toHaveBeenCalledWith('parent-123');
        expect(mockPostRepository.decrementCommentsCount).toHaveBeenCalledWith(existingComment.postId);
      });
    });

    describe('when post owner deletes comment', () => {
      it('should allow post owner to delete any comment on their post', async () => {
        // Arrange
        const postOwner = createTestUser({ id: 'post-owner-id' });
        const post = createTestPost({ authorId: postOwner.id });
        const commentAuthor = createTestUser({ id: 'commenter-id' });

        const existingComment = createTestComment({
          id: 'comment-on-my-post',
          postId: post.id,
          authorId: commentAuthor.id,
          repliesCount: 0
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockPostRepository.findById.mockResolvedValue(post);
        mockCommentRepository.countReplies.mockResolvedValue(0);
        mockCommentRepository.hardDelete.mockResolvedValue(undefined);

        // Act
        const result = await commentService.deleteComment(
          existingComment.id,
          postOwner.id,
          { isPostOwner: true }
        );

        // Assert
        expect(result.deletedBy).toBe(DeletedBy.POST_OWNER);
      });
    });

    describe('when moderator deletes comment', () => {
      it('should allow moderator to delete any comment', async () => {
        // Arrange
        const moderator = createTestUser({ id: 'moderator-id', role: 'MODERATOR' });
        const existingComment = createTestComment({
          id: 'inappropriate-comment',
          authorId: 'some-user-id',
          repliesCount: 5
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockCommentRepository.countReplies.mockResolvedValue(5);
        mockCommentRepository.softDelete.mockResolvedValue({
          ...existingComment,
          isDeleted: true,
          deletedBy: DeletedBy.MODERATOR,
          content: '[deleted]'
        });

        // Act
        const result = await commentService.deleteComment(
          existingComment.id,
          moderator.id,
          { isModerator: true }
        );

        // Assert
        expect(mockCommentRepository.softDelete).toHaveBeenCalledWith(
          existingComment.id,
          DeletedBy.MODERATOR
        );
        expect(result.deletedBy).toBe(DeletedBy.MODERATOR);
      });
    });

    describe('when unauthorized user tries to delete', () => {
      it('should reject delete by unauthorized user', async () => {
        // Arrange
        const unauthorizedUser = createTestUser({ id: 'random-user' });
        const existingComment = createTestComment({
          id: 'protected-comment',
          authorId: 'actual-author'
        });

        mockCommentRepository.findById.mockResolvedValue(existingComment);
        mockPostRepository.findById.mockResolvedValue(createTestPost({ authorId: 'post-author' }));

        // Act & Assert
        await expect(
          commentService.deleteComment(existingComment.id, unauthorizedUser.id)
        ).rejects.toThrow('Not authorized to delete this comment');

        expect(mockCommentRepository.softDelete).not.toHaveBeenCalled();
        expect(mockCommentRepository.hardDelete).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // LOAD COMMENT TREE TESTS
  // ==========================================================================

  describe('getCommentTree', () => {
    it('should load complete comment tree with nested structure', async () => {
      // Arrange
      const postId = 'post-123';
      const userId = 'current-user';

      // Flat comment data as returned from recursive CTE
      const flatComments = [
        createTestComment({ id: 'root-1', depth: 0, path: 'root-1', content: 'Root 1' }),
        createTestComment({ id: 'reply-1-1', depth: 1, path: 'root-1/reply-1-1', parentCommentId: 'root-1', content: 'Reply 1.1' }),
        createTestComment({ id: 'reply-1-2', depth: 1, path: 'root-1/reply-1-2', parentCommentId: 'root-1', content: 'Reply 1.2' }),
        createTestComment({ id: 'reply-1-1-1', depth: 2, path: 'root-1/reply-1-1/reply-1-1-1', parentCommentId: 'reply-1-1', content: 'Reply 1.1.1' }),
        createTestComment({ id: 'root-2', depth: 0, path: 'root-2', content: 'Root 2' })
      ];

      mockCommentRepository.findTreeByPostId.mockResolvedValue(flatComments);

      // Act
      const result = await commentService.getCommentTree({
        postId,
        userId,
        limit: 50,
        offset: 0
      });

      // Assert - Verify tree structure
      expect(mockCommentRepository.findTreeByPostId).toHaveBeenCalledWith(
        postId,
        expect.objectContaining({ userId, limit: 50, offset: 0 })
      );

      expect(result.comments).toHaveLength(2); // 2 root comments
      expect(result.comments[0]!.replies).toHaveLength(2); // root-1 has 2 replies
      expect(result.comments[0]!.replies[0]!.replies).toHaveLength(1); // reply-1-1 has 1 reply
      expect(result.comments[1]!.replies).toHaveLength(0); // root-2 has no replies
    });

    it('should include user reaction and permissions in response', async () => {
      // Arrange
      const postId = 'post-123';
      const userId = 'current-user';

      const flatComments = [
        {
          ...createTestComment({ id: 'comment-1', authorId: userId }),
          userReaction: 'like'
        }
      ];

      mockCommentRepository.findTreeByPostId.mockResolvedValue(flatComments);

      // Act
      const result = await commentService.getCommentTree({ postId, userId });

      // Assert
      expect(result.comments[0]!.canEdit).toBeDefined();
      expect(result.comments[0]!.canDelete).toBeDefined();
    });

    it('should return empty array when no comments exist', async () => {
      // Arrange
      const postId = 'post-with-no-comments';

      mockCommentRepository.findTreeByPostId.mockResolvedValue([]);

      // Act
      const result = await commentService.getCommentTree({ postId });

      // Assert
      expect(result.comments).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  // ==========================================================================
  // MATERIALIZED PATH TESTS
  // ==========================================================================

  describe('materialized path handling', () => {
    it('should generate correct path for top-level comment', async () => {
      // Arrange
      const post = createTestPost();
      const user = createTestUser();
      const createDTO: CreateCommentDTO = {
        postId: post.id,
        content: 'Top level comment'
      };

      mockPostRepository.findById.mockResolvedValue(post);
      mockCommentRepository.create.mockImplementation((data) => {
        // The service generates the ID and path
        return Promise.resolve({
          ...createTestComment(),
          ...data
        });
      });
      mockMentionService.extractMentions.mockReturnValue([]);

      // Act
      const result = await commentService.createComment(createDTO, user.id);

      // Assert - Top-level path equals the comment ID (UUID format)
      expect(result.path).toBe(result.id);
      expect(result.depth).toBe(0);
      // Verify path is a valid UUID format
      expect(result.path).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate correct path for nested reply', async () => {
      // Arrange
      const post = createTestPost();
      const user = createTestUser();
      const parentComment = createTestComment({
        id: 'parent-id',
        depth: 0,
        path: 'parent-id'
      });

      const createDTO: CreateCommentDTO = {
        postId: post.id,
        content: 'Reply comment',
        parentCommentId: parentComment.id
      };

      const newReplyId = 'reply-id';
      const expectedPath = 'parent-id/reply-id';

      mockPostRepository.findById.mockResolvedValue(post);
      mockCommentRepository.findById.mockResolvedValue(parentComment);
      mockCommentRepository.create.mockImplementation((data) => {
        return Promise.resolve({
          ...createTestComment(),
          ...data,
          id: newReplyId,
          path: `${parentComment.path}/${newReplyId}`
        });
      });
      mockMentionService.extractMentions.mockReturnValue([]);

      // Act
      const result = await commentService.createComment(createDTO, user.id);

      // Assert
      expect(result.path).toBe(expectedPath);
    });

    it('should generate correct path for deeply nested comment (depth 2)', async () => {
      // Arrange
      const post = createTestPost();
      const user = createTestUser();
      const level1Comment = createTestComment({
        id: 'level1-id',
        depth: 1,
        path: 'root-id/level1-id'
      });

      const createDTO: CreateCommentDTO = {
        postId: post.id,
        content: 'Deep reply',
        parentCommentId: level1Comment.id
      };

      const newReplyId = 'level2-id';
      const expectedPath = 'root-id/level1-id/level2-id';

      mockPostRepository.findById.mockResolvedValue(post);
      mockCommentRepository.findById.mockResolvedValue(level1Comment);
      mockCommentRepository.create.mockImplementation((data) => {
        return Promise.resolve({
          ...createTestComment(),
          ...data,
          id: newReplyId,
          path: `${level1Comment.path}/${newReplyId}`,
          depth: 2
        });
      });
      mockMentionService.extractMentions.mockReturnValue([]);

      // Act
      const result = await commentService.createComment(createDTO, user.id);

      // Assert
      expect(result.path).toBe(expectedPath);
      expect(result.depth).toBe(2);
    });
  });

  // ==========================================================================
  // EDGE CASES AND ERROR HANDLING
  // ==========================================================================

  describe('edge cases', () => {
    it('should reject empty content', async () => {
      // Arrange
      const user = createTestUser();
      const createDTO: CreateCommentDTO = {
        postId: 'post-123',
        content: ''
      };

      // Act & Assert
      await expect(commentService.createComment(createDTO, user.id))
        .rejects.toThrow('Comment content cannot be empty');
    });

    it('should reject content exceeding max length', async () => {
      // Arrange
      const user = createTestUser();
      const longContent = 'x'.repeat(5001);
      const createDTO: CreateCommentDTO = {
        postId: 'post-123',
        content: longContent
      };

      // Act & Assert
      await expect(commentService.createComment(createDTO, user.id))
        .rejects.toThrow('Comment content exceeds maximum length of 5000 characters');
    });

    it('should handle parent comment not found', async () => {
      // Arrange
      const post = createTestPost();
      const user = createTestUser();
      const createDTO: CreateCommentDTO = {
        postId: post.id,
        content: 'Reply to non-existent',
        parentCommentId: 'non-existent-parent'
      };

      mockPostRepository.findById.mockResolvedValue(post);
      mockCommentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(commentService.createComment(createDTO, user.id))
        .rejects.toThrow('Parent comment not found');
    });

    it('should reject reply to comment on different post', async () => {
      // Arrange
      const post = createTestPost({ id: 'post-1' });
      const user = createTestUser();
      const parentOnDifferentPost = createTestComment({
        id: 'parent-on-other-post',
        postId: 'post-2' // Different post
      });

      const createDTO: CreateCommentDTO = {
        postId: post.id,
        content: 'Cross-post reply attempt',
        parentCommentId: parentOnDifferentPost.id
      };

      mockPostRepository.findById.mockResolvedValue(post);
      mockCommentRepository.findById.mockResolvedValue(parentOnDifferentPost);

      // Act & Assert
      await expect(commentService.createComment(createDTO, user.id))
        .rejects.toThrow('Parent comment belongs to a different post');
    });

    it('should reject edit of deleted comment', async () => {
      // Arrange
      const user = createTestUser();
      const deletedComment = createTestComment({
        id: 'deleted-comment',
        authorId: user.id,
        isDeleted: true
      });

      mockCommentRepository.findById.mockResolvedValue(deletedComment);

      // Act & Assert
      await expect(
        commentService.updateComment(deletedComment.id, { content: 'Edit deleted' }, user.id)
      ).rejects.toThrow('Cannot edit a deleted comment');
    });

    it('should handle comment not found for update', async () => {
      // Arrange
      const user = createTestUser();

      mockCommentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        commentService.updateComment('non-existent', { content: 'Update' }, user.id)
      ).rejects.toThrow('Comment not found');
    });

    it('should handle comment not found for delete', async () => {
      // Arrange
      const user = createTestUser();

      mockCommentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        commentService.deleteComment('non-existent', user.id)
      ).rejects.toThrow('Comment not found');
    });
  });
});
