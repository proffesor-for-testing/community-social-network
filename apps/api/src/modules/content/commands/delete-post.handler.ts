import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  PublicationId,
  IPublicationRepository,
} from '@csn/domain-content';
import { DeletePostCommand } from './delete-post.command';

@CommandHandler(DeletePostCommand)
export class DeletePostHandler implements ICommandHandler<DeletePostCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(command: DeletePostCommand): Promise<void> {
    const postId = PublicationId.create(command.postId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.postId} not found`);
    }

    if (publication.authorId.value !== command.requesterId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    publication.delete();

    await this.publicationRepository.save(publication);
  }
}
