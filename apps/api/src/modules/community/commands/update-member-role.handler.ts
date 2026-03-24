import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  GroupId,
  IGroupRepository,
  IMembershipRepository,
  MembershipRole,
  Permission,
  isHigherRole,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { UpdateMemberRoleCommand } from './update-member-role.command';
import { Membership } from '@csn/domain-community';

@Injectable()
export class UpdateMemberRoleHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<Membership> {
    const groupId = GroupId.create(command.groupId);
    const actorUserId = UserId.create(command.actorId);
    const targetUserId = UserId.create(command.targetMemberId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check actor permission
    const actorMembership = await this.membershipRepo.findByGroupAndMember(groupId, actorUserId);
    if (!actorMembership || !actorMembership.hasPermission(Permission.MANAGE_MEMBERS)) {
      throw new ForbiddenException('You do not have permission to manage members');
    }

    // Get target membership
    const targetMembership = await this.membershipRepo.findByGroupAndMember(groupId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundException('Member not found in this group');
    }

    const newRole = command.newRole as MembershipRole;

    // Determine whether this is a promotion or demotion
    if (isHigherRole(newRole, targetMembership.role)) {
      targetMembership.promote(newRole);
    } else {
      targetMembership.demote(newRole);
    }

    await this.membershipRepo.save(targetMembership);

    return targetMembership;
  }
}
