import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  GroupId,
  IGroupRepository,
  IMembershipRepository,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { LeaveGroupCommand } from './leave-group.command';

@Injectable()
export class LeaveGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: LeaveGroupCommand): Promise<void> {
    const groupId = GroupId.create(command.groupId);
    const memberId = UserId.create(command.userId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = await this.membershipRepo.findByGroupAndMember(groupId, memberId);
    if (!membership) {
      throw new NotFoundException('Not a member of this group');
    }

    // Domain will throw if owner tries to leave
    membership.leave();

    group.decrementMemberCount();

    await this.membershipRepo.delete(membership);
    await this.groupRepo.save(group);
  }
}
