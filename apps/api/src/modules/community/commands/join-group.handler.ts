import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  GroupId,
  IGroupRepository,
  IMembershipRepository,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { JoinGroupCommand } from './join-group.command';

@Injectable()
export class JoinGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: JoinGroupCommand): Promise<Membership> {
    const groupId = GroupId.create(command.groupId);
    const memberId = UserId.create(command.userId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if already a member
    const existing = await this.membershipRepo.findByGroupAndMember(groupId, memberId);
    if (existing) {
      throw new ConflictException('Already a member of this group');
    }

    const membershipId = MembershipId.generate();
    const membership = Membership.create(
      membershipId,
      groupId,
      memberId,
      MembershipRole.MEMBER,
    );

    group.incrementMemberCount();

    await this.membershipRepo.save(membership);
    await this.groupRepo.save(group);

    return membership;
  }
}
