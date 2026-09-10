import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Publication,
  PublicationContent,
  Visibility,
  GroupId,
  IPublicationRepository,
} from '@csn/domain-content';
import { CreateGroupPostCommand } from './create-group-post.command';
import { CreatePostResult } from './create-post.handler';
import { GroupMembershipChecker } from '../services/group-membership-checker.service';

/**
 * Creates a publication scoped to a group. Only active members of the group
 * may post into it.
 */
@CommandHandler(CreateGroupPostCommand)
export class CreateGroupPostHandler
  implements ICommandHandler<CreateGroupPostCommand, CreatePostResult>
{
  constructor(
    @Inject('IPublicationRepository')
    private readonly publicationRepository: IPublicationRepository,
    @Inject(GroupMembershipChecker)
    private readonly membership: GroupMembershipChecker,
  ) {}

  async execute(command: CreateGroupPostCommand): Promise<CreatePostResult> {
    const isMember = await this.membership.isActiveMember(
      command.groupId,
      command.authorId,
    );
    if (!isMember) {
      throw new ForbiddenException('Only group members can post to this group');
    }

    const publication = Publication.create(
      this.publicationRepository.nextId(),
      UserId.create(command.authorId),
      PublicationContent.create(command.content),
      Visibility.create(command.visibility),
      GroupId.create(command.groupId),
    );

    await this.publicationRepository.save(publication);

    return new CreatePostResult(publication.id.value);
  }
}
