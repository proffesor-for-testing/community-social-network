import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  GroupId,
  IGroupRepository,
  IMembershipRepository,
  Permission,
  isHigherRole,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { KickMemberCommand } from './kick-member.command';

@Injectable()
export class KickMemberHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: KickMemberCommand): Promise<void> {
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
      throw new ForbiddenException('You do not have permission to kick members');
    }

    // Get target membership
    const targetMembership = await this.membershipRepo.findByGroupAndMember(groupId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundException('Member not found in this group');
    }

    // Actor must have a higher role than target to kick
    if (!isHigherRole(actorMembership.role, targetMembership.role)) {
      throw new ForbiddenException('Cannot kick a member with equal or higher role');
    }

    // Domain will throw if trying to kick the owner
    targetMembership.kick(command.actorId, command.reason ?? 'No reason provided');

    group.decrementMemberCount();

    await this.membershipRepo.delete(targetMembership);
    await this.groupRepo.save(group);
  }
}
