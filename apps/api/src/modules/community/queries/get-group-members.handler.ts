import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '@csn/domain-shared';
import {
  GroupId,
  IGroupRepository,
  IMembershipRepository,
  Membership,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { GetGroupMembersQuery } from './get-group-members.query';

@Injectable()
export class GetGroupMembersHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(query: GetGroupMembersQuery): Promise<PaginatedResult<Membership>> {
    const groupId = GroupId.create(query.groupId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.membershipRepo.findByGroupId(groupId, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
