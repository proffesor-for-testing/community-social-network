import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  GroupStatus,
  MembershipRole,
  IGroupRepository,
  IMembershipRepository,
} from '@csn/domain-community';
import {
  InMemoryGroupRepository,
  InMemoryMembershipRepository,
} from '@csn/infra-community';
import { CreateGroupHandler } from '../commands/create-group.handler';
import { CreateGroupCommand } from '../commands/create-group.command';

describe('CreateGroupHandler', () => {
  let handler: CreateGroupHandler;
  let groupRepo: InMemoryGroupRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    groupRepo = new InMemoryGroupRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new CreateGroupHandler(
      groupRepo as unknown as IGroupRepository,
      membershipRepo as unknown as IMembershipRepository,
    );
  });

  it('should create a group with default settings', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(
      userId,
      'My Group',
      'A test group',
    );

    const group = await handler.execute(command);

    expect(group.name.value).toBe('My Group');
    expect(group.description.value).toBe('A test group');
    expect(group.ownerId.value).toBe(userId);
    expect(group.status).toBe(GroupStatus.ACTIVE);
    expect(group.memberCount).toBe(1);
    expect(group.settings.isPublic).toBe(true);
    expect(group.settings.requireApproval).toBe(false);
    expect(group.settings.allowMemberPosts).toBe(true);
  });

  it('should create a group with custom settings', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(
      userId,
      'Private Group',
      'A private group',
      {
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: false,
      },
    );

    const group = await handler.execute(command);

    expect(group.settings.isPublic).toBe(false);
    expect(group.settings.requireApproval).toBe(true);
    expect(group.settings.allowMemberPosts).toBe(false);
  });

  it('should persist the group in the repository', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(userId, 'Saved Group', 'Desc');

    const group = await handler.execute(command);

    const found = await groupRepo.findById(group.id);
    expect(found).not.toBeNull();
    expect(found!.name.value).toBe('Saved Group');
  });

  it('should create an OWNER membership for the creator', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(userId, 'Owner Test', 'Desc');

    const group = await handler.execute(command);

    const memberships = await membershipRepo.findByGroupId(group.id);
    expect(memberships.items).toHaveLength(1);
    expect(memberships.items[0].memberId.value).toBe(userId);
    expect(memberships.items[0].role).toBe(MembershipRole.OWNER);
  });

  it('should create a group with empty description when not provided', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(userId, 'No Desc', '');

    const group = await handler.execute(command);

    expect(group.description.value).toBe('');
  });

  it('should throw when group name is empty', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(userId, '', 'Desc');

    await expect(handler.execute(command)).rejects.toThrow();
  });

  it('should throw when userId is not a valid UUID', async () => {
    const command = new CreateGroupCommand('invalid-uuid', 'Group', 'Desc');

    await expect(handler.execute(command)).rejects.toThrow();
  });

  it('should create multiple groups with different IDs', async () => {
    const userId = UserId.generate().value;
    const command1 = new CreateGroupCommand(userId, 'Group 1', 'Desc 1');
    const command2 = new CreateGroupCommand(userId, 'Group 2', 'Desc 2');

    const group1 = await handler.execute(command1);
    const group2 = await handler.execute(command2);

    expect(group1.id.value).not.toBe(group2.id.value);
    expect(groupRepo.size).toBe(2);
  });

  it('should set memberCount to 1 after creation (owner is first member)', async () => {
    const userId = UserId.generate().value;
    const command = new CreateGroupCommand(userId, 'Count Test', 'Desc');

    const group = await handler.execute(command);
    const persisted = await groupRepo.findById(group.id);

    expect(persisted!.memberCount).toBe(1);
  });
});
