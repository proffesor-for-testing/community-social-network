import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PublicationId,
  ReactionType,
  IPublicationRepository,
} from '@csn/domain-content';
import { ReactionEntity } from '@csn/infra-content';
import { RemoveReactionCommand } from './remove-reaction.command';

@CommandHandler(RemoveReactionCommand)
export class RemoveReactionHandler implements ICommandHandler<RemoveReactionCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @InjectRepository(ReactionEntity)
    private readonly reactionRepository: Repository<ReactionEntity>,
  ) {}

  async execute(command: RemoveReactionCommand): Promise<void> {
    const postId = PublicationId.create(command.targetId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.targetId} not found`);
    }

    // Domain rule check (validates the type) — throws if invalid.
    ReactionType.create(command.reactionType);

    // Reactions are persisted as one row per (publication, user) — see
    // AddReactionHandler's upsert. Removing means deleting that row; the
    // reaction counts are derived from the rows on read, so nothing else
    // needs to change. Idempotent: deleting a missing row is a no-op.
    await this.reactionRepository.delete({
      publicationId: command.targetId,
      userId: command.userId,
    });
  }
}
