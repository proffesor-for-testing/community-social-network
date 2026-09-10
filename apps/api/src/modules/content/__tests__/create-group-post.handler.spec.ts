import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { VisibilityEnum } from '@csn/domain-content';
import {
  GroupId as CommunityGroupId,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';
import { InMemoryPublicationRepository } from '@csn/infra-content';
import { InMemoryMembershipRepository } from '@csn/infra-community';
import { CreateGroupPostHandler } from '../commands/create-group-post.handler';
import { CreateGroupPostCommand } from '../commands/create-group-post.command';
import { GroupMembershipChecker } from '../services/group-membership-checker.service';

describe('CreateGroupPostHandler', () => {
  let publications: InMemoryPublicationRepository;
  let memberships: InMemoryMembershipRepository;
  let handler: CreateGroupPostHandler;
  let groupId: CommunityGroupId;
  let member: UserId;
  let outsider: UserId;

  beforeEach(async () => {
    publications = new InMemoryPublicationRepository();
    memberships = new InMemoryMembershipRepository();
    handler = new CreateGroupPostHandler(
      publications as never,
      new GroupMembershipChecker(memberships as never),
    );

    groupId = CommunityGroupId.generate();
    member = UserId.generate();
    outsider = UserId.generate();

    await memberships.save(
      Membership.create(
        MembershipId.generate(),
        groupId,
        member,
        MembershipRole.MEMBER,
      ),
    );
  });

  it('should persist a publication for an active group member', async () => {
    // Arrange
    const command = new CreateGroupPostCommand(
      groupId.value,
      member.value,
      'Hello group',
    );

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.publicationId).toBeDefined();
  });

  it('should stamp the created publication with the group id', async () => {
    // Arrange
    const command = new CreateGroupPostCommand(groupId.value, member.value, 'Hi');

    // Act
    const result = await handler.execute(command);

    // Assert
    const saved = await publications.findByGroupId(
      { value: groupId.value } as never,
      { limit: 10 },
    );
    expect(saved.map((p) => p.id.value)).toEqual([result.publicationId]);
  });

  it('should default a group post to GROUP_ONLY visibility', async () => {
    // Arrange
    const command = new CreateGroupPostCommand(groupId.value, member.value, 'Hi');

    // Act
    await handler.execute(command);

    // Assert
    const saved = await publications.findByGroupId(
      { value: groupId.value } as never,
      { limit: 10 },
    );
    expect(saved[0]!.visibility.value).toBe(VisibilityEnum.GROUP_ONLY);
  });

  it('should reject a post from someone who is not a member of the group', async () => {
    // Arrange
    const command = new CreateGroupPostCommand(
      groupId.value,
      outsider.value,
      'Let me in',
    );

    // Act / Assert
    await expect(handler.execute(command)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should not persist anything when the author is not a member', async () => {
    // Arrange
    const command = new CreateGroupPostCommand(groupId.value, outsider.value, 'x');

    // Act
    await handler.execute(command).catch(() => undefined);

    // Assert
    expect(publications.size).toBe(0);
  });

  it('should reject a member of a different group', async () => {
    // Arrange
    const otherGroup = CommunityGroupId.generate();
    const command = new CreateGroupPostCommand(
      otherGroup.value,
      member.value,
      'wrong group',
    );

    // Act / Assert
    await expect(handler.execute(command)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
