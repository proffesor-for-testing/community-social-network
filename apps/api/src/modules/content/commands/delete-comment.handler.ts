import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DiscussionId, IDiscussionRepository } from '@csn/domain-content';
import { DeleteCommentCommand } from './delete-comment.command';

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentHandler implements ICommandHandler<DeleteCommentCommand, void> {
  constructor(
    @Inject('IDiscussionRepository')
    private readonly discussionRepository: IDiscussionRepository,
  ) {}

  async execute(command: DeleteCommentCommand): Promise<void> {
    const commentId = DiscussionId.create(command.commentId);
    const discussion = await this.discussionRepository.findById(commentId);

    if (!discussion) {
      throw new NotFoundException(`Comment ${command.commentId} not found`);
    }

    if (discussion.authorId.value !== command.userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    discussion.delete();
    await this.discussionRepository.save(discussion);
  }
}
