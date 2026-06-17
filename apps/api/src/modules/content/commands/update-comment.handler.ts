import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  DiscussionId,
  DiscussionContent,
  IDiscussionRepository,
} from '@csn/domain-content';
import { UpdateCommentCommand } from './update-comment.command';

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentHandler implements ICommandHandler<UpdateCommentCommand, void> {
  constructor(
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
  ) {}

  async execute(command: UpdateCommentCommand): Promise<void> {
    const commentId = DiscussionId.create(command.commentId);
    const discussion = await this.discussionRepository.findById(commentId);

    if (!discussion) {
      throw new NotFoundException(`Comment ${command.commentId} not found`);
    }

    if (discussion.authorId.value !== command.userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    discussion.editContent(DiscussionContent.create(command.newContent));
    await this.discussionRepository.save(discussion);
  }
}
