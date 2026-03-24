import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  IPublicationRepository,
} from '@csn/domain-content';
import { CreatePostCommand } from './create-post.command';

export class CreatePostResult {
  constructor(public readonly publicationId: string) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostHandler implements ICommandHandler<CreatePostCommand, CreatePostResult> {
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
  ) {}

  async execute(command: CreatePostCommand): Promise<CreatePostResult> {
    const id = this.publicationRepository.nextId();
    const authorId = UserId.create(command.authorId);
    const content = PublicationContent.create(command.content);
    const visibility = Visibility.create(command.visibility);

    const publication = Publication.create(id, authorId, content, visibility);

    await this.publicationRepository.save(publication);

    return new CreatePostResult(publication.id.value);
  }
}
