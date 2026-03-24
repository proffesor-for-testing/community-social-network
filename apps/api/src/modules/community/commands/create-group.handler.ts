import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  IGroupRepository,
  Membership,
  MembershipId,
  MembershipRole,
  IMembershipRepository,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { CreateGroupCommand } from './create-group.command';

@Injectable()
export class CreateGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: CreateGroupCommand): Promise<Group> {
    const groupId = GroupId.generate();
    const ownerId = UserId.create(command.userId);
    const name = GroupName.create(command.name);
    const description = command.description
      ? GroupDescription.create(command.description)
      : GroupDescription.empty();

    const settings = command.settings
      ? GroupSettings.create({
          isPublic: command.settings.isPublic ?? true,
          requireApproval: command.settings.requireApproval ?? false,
          allowMemberPosts: command.settings.allowMemberPosts ?? true,
        })
      : undefined;

    const group = Group.create(groupId, name, description, ownerId, settings);

    // Create owner membership
    const membershipId = MembershipId.generate();
    const membership = Membership.create(
      membershipId,
      groupId,
      ownerId,
      MembershipRole.OWNER,
    );

    group.incrementMemberCount();

    await this.groupRepo.save(group);
    await this.membershipRepo.save(membership);

    return group;
  }
}
