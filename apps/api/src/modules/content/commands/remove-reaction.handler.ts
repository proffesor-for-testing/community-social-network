import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import {
  PublicationId,
  ReactionType,
  IPublicationRepository,
} from '@csn/domain-content';
import { RemoveReactionCommand } from './remove-reaction.command';

@CommandHandler(RemoveReactionCommand)
export class RemoveReactionHandler implements ICommandHandler<RemoveReactionCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(command: RemoveReactionCommand): Promise<void> {
    const postId = PublicationId.create(command.targetId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.targetId} not found`);
    }

    const reactionType = ReactionType.create(command.reactionType);
    publication.removeReaction(command.userId, reactionType);

    await this.publicationRepository.save(publication);
  }
}
