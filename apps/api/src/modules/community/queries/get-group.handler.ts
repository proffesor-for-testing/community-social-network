import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GroupId, IGroupRepository, Group } from '@csn/domain-community';
import { GROUP_REPOSITORY } from '@csn/infra-community';
import { GetGroupQuery } from './get-group.query';

@Injectable()
export class GetGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(query: GetGroupQuery): Promise<Group> {
    const groupId = GroupId.create(query.groupId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }
}
