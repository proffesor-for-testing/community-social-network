import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  DiscussionContent,
  PublicationId,
} from '@csn/domain-content';
import { UpdateCommentHandler } from '../commands/update-comment.handler';
import { UpdateCommentCommand } from '../commands/update-comment.command';

function makeDiscussion(authorId: UserId): Discussion {
  return Discussion.create(
    DiscussionId.generate(),
    PublicationId.generate(),
    authorId,
    DiscussionContent.create('original body'),
  );
}

describe('UpdateCommentHandler', () => {
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
    const handler = new UpdateCommentHandler(repo as never);

    // Act + Assert
    await expect(
      handler.execute(new UpdateCommentCommand(DiscussionId.generate().value, author.value, 'new body')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw ForbiddenException when the caller is NOT the author', async () => {
    // Arrange
    const handler = new UpdateCommentHandler(repo as never);
    const otherUser = UserId.generate();

    // Act + Assert
    await expect(
      handler.execute(new UpdateCommentCommand(comment.id.value, otherUser.value, 'new body')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should replace the comment content on successful author edit', async () => {
    // Arrange
    const handler = new UpdateCommentHandler(repo as never);

    // Act
    await handler.execute(
      new UpdateCommentCommand(comment.id.value, author.value, 'updated body text'),
    );

    // Assert
    expect(comment.content.text).toBe('updated body text');
  });

  it('should persist the edit via the repository save call', async () => {
    // Arrange
    const handler = new UpdateCommentHandler(repo as never);

    // Act
    await handler.execute(
      new UpdateCommentCommand(comment.id.value, author.value, 'updated body'),
    );

    // Assert
    expect(repo.save).toHaveBeenCalledWith(comment);
  });

  it('should NOT call save when authorization fails', async () => {
    // Arrange
    const handler = new UpdateCommentHandler(repo as never);

    // Act
    await expect(
      handler.execute(new UpdateCommentCommand(comment.id.value, 'other', 'x')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Assert
    expect(repo.save).not.toHaveBeenCalled();
  });
});
