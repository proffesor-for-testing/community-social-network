import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  ReactionTypeEnum,
} from '@csn/domain-content';
import { RemoveReactionHandler } from '../commands/remove-reaction.handler';
import { RemoveReactionCommand } from '../commands/remove-reaction.command';

function makePublication(): Publication {
  return Publication.create(
    PublicationId.generate(),
    UserId.generate(),
    PublicationContent.create('body'),
    Visibility.PUBLIC,
  );
}

describe('RemoveReactionHandler — persistence', () => {
  let publication: Publication;
  let publicationRepo: { findById: ReturnType<typeof vi.fn> };
  let reactionRepo: { delete: ReturnType<typeof vi.fn> };
  let handler: RemoveReactionHandler;

  beforeEach(() => {
    // Arrange (shared)
    publication = makePublication();
    publicationRepo = { findById: vi.fn().mockResolvedValue(publication) };
    reactionRepo = { delete: vi.fn().mockResolvedValue({ affected: 1 }) };
    handler = new RemoveReactionHandler(publicationRepo as never, reactionRepo as never);
  });

  it('should delete the (publication, user) reaction row', async () => {
    // Arrange
    const command = new RemoveReactionCommand(publication.id.value, 'post', 'user-1', ReactionTypeEnum.LIKE);

    // Act
    await handler.execute(command);

    // Assert
    expect(reactionRepo.delete).toHaveBeenCalledWith({
      publicationId: publication.id.value,
      userId: 'user-1',
    });
  });

  it('should delete exactly once per command', async () => {
    // Arrange
    const command = new RemoveReactionCommand(publication.id.value, 'post', 'user-1', ReactionTypeEnum.LOVE);

    // Act
    await handler.execute(command);

    // Assert
    expect(reactionRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException and not touch the reaction table when the post is missing', async () => {
    // Arrange
    publicationRepo.findById.mockResolvedValue(null);
    const command = new RemoveReactionCommand(PublicationId.generate().value, 'post', 'user-1', ReactionTypeEnum.LIKE);

    // Act
    const act = handler.execute(command);

    // Assert
    await expect(act).rejects.toBeInstanceOf(NotFoundException);
    expect(reactionRepo.delete).not.toHaveBeenCalled();
  });

  it('should reject an invalid reaction type before deleting anything', async () => {
    // Arrange
    const command = new RemoveReactionCommand(publication.id.value, 'post', 'user-1', 'NOPE' as ReactionTypeEnum);

    // Act
    const act = handler.execute(command);

    // Assert
    await expect(act).rejects.toThrow();
    expect(reactionRepo.delete).not.toHaveBeenCalled();
  });

  it('should be idempotent: removing a reaction that does not exist resolves without error', async () => {
    // Arrange
    reactionRepo.delete.mockResolvedValue({ affected: 0 });
    const command = new RemoveReactionCommand(publication.id.value, 'post', 'user-1', ReactionTypeEnum.LIKE);

    // Act
    const act = handler.execute(command);

    // Assert
    await expect(act).resolves.toBeUndefined();
  });
});
