import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  GroupRule,
  IGroupRepository,
  IMembershipRepository,
  Permission,
} from '@csn/domain-community';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { UpdateGroupCommand } from './update-group.command';

@Injectable()
export class UpdateGroupHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: UpdateGroupCommand): Promise<Group> {
    const groupId = GroupId.create(command.groupId);
    const userId = UserId.create(command.userId);

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check permission: must be owner or admin
    const membership = await this.membershipRepo.findByGroupAndMember(groupId, userId);
    if (!membership || !membership.hasPermission(Permission.MANAGE_SETTINGS)) {
      throw new ForbiddenException('Only owners and admins can update group settings');
    }

    // Build updated values, falling back to current values for unspecified fields
    const newName = command.name !== undefined
      ? GroupName.create(command.name)
      : group.name;

    const newDescription = command.description !== undefined
      ? GroupDescription.create(command.description)
      : group.description;

    const newSettings = command.settings
      ? GroupSettings.create({
          isPublic: command.settings.isPublic ?? group.settings.isPublic,
          requireApproval: command.settings.requireApproval ?? group.settings.requireApproval,
          allowMemberPosts: command.settings.allowMemberPosts ?? group.settings.allowMemberPosts,
        })
      : group.settings;

    // If settings changed, use the domain method so events are emitted
    if (command.settings) {
      group.updateSettings(newSettings);
    }

    // For name/description changes, reconstitute with the updated values
    // (the domain aggregate does not expose setters for name/description)
    const hasNameOrDescChange =
      command.name !== undefined || command.description !== undefined;

    if (hasNameOrDescChange) {
      const rules: GroupRule[] = [...group.rules] as GroupRule[];
      const rebuilt = Group.reconstitute(
        group.id,
        newName,
        newDescription,
        group.ownerId,
        command.settings ? newSettings : group.settings,
        rules,
        group.status,
        group.memberCount,
        group.createdAt,
        group.version,
      );
      await this.groupRepo.save(rebuilt);
      return rebuilt;
    }

    await this.groupRepo.save(group);
    return group;
  }
}
