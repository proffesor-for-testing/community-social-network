import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  DiscussionContent,
  PublicationId,
  IPublicationRepository,
  IDiscussionRepository,
} from '@csn/domain-content';
import { AlertType } from '@csn/domain-notification';
import { CreateCommentCommand } from './create-comment.command';
import { AlertCreatorService } from '../../notification/services/alert-creator.service';

export class CreateCommentResult {
  constructor(public readonly commentId: string) {}
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<CreateCommentCommand, CreateCommentResult> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
    private readonly alerts: AlertCreatorService,
  ) {}

  async execute(command: CreateCommentCommand): Promise<CreateCommentResult> {
    const postId = PublicationId.create(command.postId);

    const publication = await this.publicationRepository.findById(postId);
    if (!publication) {
      throw new NotFoundException(`Post ${command.postId} not found`);
    }

    let parentId: DiscussionId | null = null;
    if (command.parentCommentId) {
      parentId = DiscussionId.create(command.parentCommentId);
      const parentComment = await this.discussionRepository.findById(parentId);
      if (!parentComment) {
        throw new NotFoundException(`Parent comment ${command.parentCommentId} not found`);
      }
    }

    const id = this.discussionRepository.nextId();
    const authorId = UserId.create(command.authorId);
    const content = DiscussionContent.create(command.content);

    const discussion = Discussion.create(id, postId, authorId, content, parentId);

    await this.discussionRepository.save(discussion);

    // Notify the post author that someone commented (self-notify guarded inside).
    await this.alerts.create({
      recipientId: publication.authorId.value,
      actorId: command.authorId,
      type: AlertType.COMMENT,
      verb: 'commented on your post',
      actionUrl: `/posts/${command.postId}`,
      sourceId: discussion.id.value,
    });

    return new CreateCommentResult(discussion.id.value);
  }
}
