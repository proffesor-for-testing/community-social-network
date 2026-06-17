import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  DiscussionContent,
  PublicationId,
} from '@csn/domain-content';
import { DeleteCommentHandler } from '../commands/delete-comment.handler';
import { DeleteCommentCommand } from '../commands/delete-comment.command';

function makeDiscussion(authorId: UserId): Discussion {
  return Discussion.create(
    DiscussionId.generate(),
    PublicationId.generate(),
    authorId,
    DiscussionContent.create('orig comment'),
  );
}

describe('DeleteCommentHandler', () => {
  let author: UserId;
  let comment: Discussion;
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Arrange (shared)
    author = UserId.generate();
    comment = makeDiscussion(author);
    repo = {
      findById: vi.fn(async () => comment),
      save: vi.fn(async () => undefined),
    };
  });

  it('should throw NotFoundException when the comment does not exist', async () => {
    // Arrange
    repo.findById.mockResolvedValueOnce(null);
    const handler = new DeleteCommentHandler(repo as never);

    // Act + Assert
    await expect(
      handler.execute(new DeleteCommentCommand(DiscussionId.generate().value, author.value)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw ForbiddenException when the caller is NOT the author', async () => {
    // Arrange
    const handler = new DeleteCommentHandler(repo as never);
    const otherUser = UserId.generate();

    // Act + Assert
    await expect(
      handler.execute(new DeleteCommentCommand(comment.id.value, otherUser.value)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should soft-delete the comment when the author requests it', async () => {
    // Arrange
    const handler = new DeleteCommentHandler(repo as never);

    // Act
    await handler.execute(new DeleteCommentCommand(comment.id.value, author.value));

    // Assert
    expect(comment.status.isDeleted()).toBe(true);
  });

  it('should persist the deletion via the repository save call', async () => {
    // Arrange
    const handler = new DeleteCommentHandler(repo as never);

    // Act
    await handler.execute(new DeleteCommentCommand(comment.id.value, author.value));

    // Assert
    expect(repo.save).toHaveBeenCalledWith(comment);
  });

  it('should NOT call save when authorization fails', async () => {
    // Arrange
    const handler = new DeleteCommentHandler(repo as never);

    // Act
    await expect(
      handler.execute(new DeleteCommentCommand(comment.id.value, 'other-user-id')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Assert
    expect(repo.save).not.toHaveBeenCalled();
  });
});
