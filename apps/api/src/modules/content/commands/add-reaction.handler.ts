import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  PublicationId,
  ReactionType,
  IPublicationRepository,
} from '@csn/domain-content';
import { ReactionEntity } from '@csn/infra-content';
import { AlertType } from '@csn/domain-notification';
import { AddReactionCommand } from './add-reaction.command';
import { AlertCreatorService } from '../../notification/services/alert-creator.service';

@CommandHandler(AddReactionCommand)
export class AddReactionHandler implements ICommandHandler<AddReactionCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @InjectRepository(ReactionEntity)
    private readonly reactionRepository: Repository<ReactionEntity>,
    @Inject(AlertCreatorService)
    private readonly alerts: AlertCreatorService,
  ) {}

  async execute(command: AddReactionCommand): Promise<void> {
    const postId = PublicationId.create(command.targetId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.targetId} not found`);
    }

    // Domain rule check (also validates type) — throws if invalid.
    ReactionType.create(command.reactionType);

    // Persist a row in publication_reactions. The unique constraint on
    // (publication_id, user_id) means a second reaction from the same user
    // upserts the type via ON CONFLICT — the row count stays stable, the
    // type updates. Use upsert so reactionCounts derived from the rows is
    // always correct on read.
    await this.reactionRepository.upsert(
      {
        id: randomUUID(),
        publicationId: command.targetId,
        userId: command.userId,
        type: command.reactionType,
      },
      {
        conflictPaths: ['publicationId', 'userId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    // Notify the post author that someone reacted (self-notify guarded inside).
    await this.alerts.create({
      recipientId: publication.authorId.value,
      actorId: command.userId,
      type: AlertType.LIKE,
      verb: `reacted (${command.reactionType.toLowerCase()}) to your post`,
      actionUrl: `/posts/${command.targetId}`,
      sourceId: command.targetId,
    });
  }
}
