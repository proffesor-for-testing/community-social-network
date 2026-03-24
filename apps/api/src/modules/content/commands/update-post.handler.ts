import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  PublicationId,
  PublicationContent,
  IPublicationRepository,
} from '@csn/domain-content';
import { UpdatePostCommand } from './update-post.command';

@CommandHandler(UpdatePostCommand)
export class UpdatePostHandler implements ICommandHandler<UpdatePostCommand, void> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(command: UpdatePostCommand): Promise<void> {
    const postId = PublicationId.create(command.postId);
    const publication = await this.publicationRepository.findById(postId);

    if (!publication) {
      throw new NotFoundException(`Post ${command.postId} not found`);
    }

    if (publication.authorId.value !== command.requesterId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (command.content !== undefined) {
      const newContent = PublicationContent.create(command.content);
      publication.edit(newContent);
    }

    await this.publicationRepository.save(publication);
  }
}
