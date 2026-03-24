import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import {
  PublicationId,
  ReactionType,
  IPublicationRepository,
} from '@csn/domain-content';
import { AddReactionCommand } from './add-reaction.command';

@CommandHandler(AddReactionCommand)
export class AddReactionHandler implements ICommandHandler<AddReactionCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(command: AddReactionCommand): Promise<void> {
    // Currently reactions are tracked on the Publication aggregate
    const postId = PublicationId.create(command.targetId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.targetId} not found`);
    }

    const reactionType = ReactionType.create(command.reactionType);
    publication.addReaction(command.userId, reactionType);

    await this.publicationRepository.save(publication);
  }
}
