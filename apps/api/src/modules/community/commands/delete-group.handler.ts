import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { GroupId, IGroupRepository } from '@csn/domain-community';
import { GROUP_REPOSITORY } from '@csn/infra-community';
import { DeleteGroupCommand } from './delete-group.command';

@Injectable()
export class DeleteGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(command: DeleteGroupCommand): Promise<void> {
    const groupId = GroupId.create(command.groupId);
    const userId = UserId.create(command.userId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only the owner can delete (archive) the group
    if (!group.ownerId.equals(userId)) {
      throw new ForbiddenException('Only the group owner can delete the group');
    }

    group.archive();
    await this.groupRepo.save(group);
  }
}
