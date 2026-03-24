/**
 * Integration Test: Community - Group Lifecycle
 *
 * Exercises the full group management lifecycle through the real handlers
 * wired to in-memory repositories.
 *
 * Flow:
 * 1. Create a group (owner gets OWNER membership)
 * 2. Another user joins
 * 3. Owner promotes user to ADMIN
 * 4. Admin cannot transfer ownership (only owner-level actions)
 * 5. User leaves group
 * 6. Owner deletes (archives) group
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

// ── Handlers ────────────────────────────────────────────────────────────────

import { CreateGroupHandler } from '../../../apps/api/src/modules/community/commands/create-group.handler';
import { CreateGroupCommand } from '../../../apps/api/src/modules/community/commands/create-group.command';
import { JoinGroupHandler } from '../../../apps/api/src/modules/community/commands/join-group.handler';
import { JoinGroupCommand } from '../../../apps/api/src/modules/community/commands/join-group.command';
import { UpdateMemberRoleHandler } from '../../../apps/api/src/modules/community/commands/update-member-role.handler';
import { UpdateMemberRoleCommand } from '../../../apps/api/src/modules/community/commands/update-member-role.command';
import { LeaveGroupHandler } from '../../../apps/api/src/modules/community/commands/leave-group.handler';
import { LeaveGroupCommand } from '../../../apps/api/src/modules/community/commands/leave-group.command';
import { DeleteGroupHandler } from '../../../apps/api/src/modules/community/commands/delete-group.handler';
import { DeleteGroupCommand } from '../../../apps/api/src/modules/community/commands/delete-group.command';
import { GetGroupHandler } from '../../../apps/api/src/modules/community/queries/get-group.handler';
import { GetGroupQuery } from '../../../apps/api/src/modules/community/queries/get-group.query';
import { GetGroupMembersHandler } from '../../../apps/api/src/modules/community/queries/get-group-members.handler';
import { GetGroupMembersQuery } from '../../../apps/api/src/modules/community/queries/get-group-members.query';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  GROUP_REPOSITORY,
  MEMBERSHIP_REPOSITORY,
} from '../../setup/test-app';

describe('Community: Group Lifecycle', () => {
  let module: TestingModule;
  let repos: TestRepositories;

  let createGroupHandler: CreateGroupHandler;
  let joinGroupHandler: JoinGroupHandler;
  let updateMemberRoleHandler: UpdateMemberRoleHandler;
  let leaveGroupHandler: LeaveGroupHandler;
  let deleteGroupHandler: DeleteGroupHandler;
  let getGroupHandler: GetGroupHandler;
  let getGroupMembersHandler: GetGroupMembersHandler;

  const ownerId = randomUUID();
  const userId = randomUUID();
  const userId2 = randomUUID();

  beforeEach(async () => {
    repos = createTestRepositories();

    module = await Test.createTestingModule({
      providers: [
        CreateGroupHandler,
        JoinGroupHandler,
        UpdateMemberRoleHandler,
        LeaveGroupHandler,
        DeleteGroupHandler,
        GetGroupHandler,
        GetGroupMembersHandler,
        { provide: GROUP_REPOSITORY, useValue: repos.groupRepo },
        { provide: MEMBERSHIP_REPOSITORY, useValue: repos.membershipRepo },
      ],
    }).compile();

    createGroupHandler = module.get(CreateGroupHandler);
    joinGroupHandler = module.get(JoinGroupHandler);
    updateMemberRoleHandler = module.get(UpdateMemberRoleHandler);
    leaveGroupHandler = module.get(LeaveGroupHandler);
    deleteGroupHandler = module.get(DeleteGroupHandler);
    getGroupHandler = module.get(GetGroupHandler);
    getGroupMembersHandler = module.get(GetGroupMembersHandler);
  });

  // ── Step 1: Create a group ────────────────────────────────────────────

  it('should create a group with owner membership', async () => {
    const command = new CreateGroupCommand(
      ownerId,
      'Test Community Group',
      'A group for integration testing',
      { isPublic: true, requireApproval: false, allowMemberPosts: true },
    );

    const group = await createGroupHandler.execute(command);

    expect(group).toBeDefined();
    expect(group.id).toBeDefined();

    // Verify group persisted
    expect(repos.groupRepo.size).toBe(1);
    // Verify owner membership created
    expect(repos.membershipRepo.size).toBe(1);
  });

  // ── Step 2: Another user joins ────────────────────────────────────────

  it('should allow a user to join a group', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Joinable Group', '', undefined),
    );

    const joinCommand = new JoinGroupCommand(userId, group.id.value);
    const membership = await joinGroupHandler.execute(joinCommand);

    expect(membership).toBeDefined();
    expect(membership.role).toBe('MEMBER');

    // Verify 2 memberships: owner + new member
    expect(repos.membershipRepo.size).toBe(2);
  });

  // ── Duplicate join prevention ─────────────────────────────────────────

  it('should reject duplicate group join', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'No Dups Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));
    await expect(
      joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value)),
    ).rejects.toThrow(ConflictException);
  });

  // ── Join non-existent group ───────────────────────────────────────────

  it('should reject joining non-existent group', async () => {
    const fakeGroupId = randomUUID();
    await expect(
      joinGroupHandler.execute(new JoinGroupCommand(userId, fakeGroupId)),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Step 3: Owner promotes user to ADMIN ──────────────────────────────

  it('should allow owner to promote a member to ADMIN', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Promotable Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));

    const updateCommand = new UpdateMemberRoleCommand(
      ownerId,
      group.id.value,
      userId,
      'ADMIN',
    );
    const updated = await updateMemberRoleHandler.execute(updateCommand);

    expect(updated.role).toBe('ADMIN');
  });

  // ── Step 4: Non-owner cannot transfer ownership (promote to OWNER) ────

  it('should prevent admin from promoting to OWNER role', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Admin Limits Group', '', undefined),
    );

    // User joins and gets promoted to admin
    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));
    await updateMemberRoleHandler.execute(
      new UpdateMemberRoleCommand(ownerId, group.id.value, userId, 'ADMIN'),
    );

    // Another user joins
    await joinGroupHandler.execute(new JoinGroupCommand(userId2, group.id.value));

    // Admin tries to promote userId2 to OWNER - the domain should prevent this
    // because only the domain's ownership transfer mechanism can create OWNER roles.
    // The handler checks permission: admin has MANAGE_MEMBERS but promoting to OWNER
    // requires the promote() method on Membership, which throws CannotPromoteToOwnerError.
    await expect(
      updateMemberRoleHandler.execute(
        new UpdateMemberRoleCommand(userId, group.id.value, userId2, 'OWNER'),
      ),
    ).rejects.toThrow(); // Domain error - cannot promote to OWNER
  });

  // ── Regular member cannot manage roles ────────────────────────────────

  it('should prevent regular member from changing roles', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Member Limits Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));
    await joinGroupHandler.execute(new JoinGroupCommand(userId2, group.id.value));

    // Regular member tries to promote
    await expect(
      updateMemberRoleHandler.execute(
        new UpdateMemberRoleCommand(userId, group.id.value, userId2, 'ADMIN'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Step 5: User leaves group ─────────────────────────────────────────

  it('should allow a member to leave the group', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Leavable Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));
    expect(repos.membershipRepo.size).toBe(2);

    await leaveGroupHandler.execute(new LeaveGroupCommand(userId, group.id.value));

    // Only the owner membership should remain
    expect(repos.membershipRepo.size).toBe(1);
  });

  // ── Non-member cannot leave ───────────────────────────────────────────

  it('should reject leave for non-member', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Exclusive Group', '', undefined),
    );

    await expect(
      leaveGroupHandler.execute(new LeaveGroupCommand(userId, group.id.value)),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Step 6: Owner deletes (archives) the group ────────────────────────

  it('should allow owner to delete (archive) the group', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Deletable Group', '', undefined),
    );

    await deleteGroupHandler.execute(
      new DeleteGroupCommand(ownerId, group.id.value),
    );

    // Group should still exist but be archived
    const archived = await getGroupHandler.execute(new GetGroupQuery(group.id.value));
    expect(archived).toBeDefined();
  });

  // ── Non-owner cannot delete ───────────────────────────────────────────

  it('should prevent non-owner from deleting the group', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Protected Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));

    await expect(
      deleteGroupHandler.execute(new DeleteGroupCommand(userId, group.id.value)),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Get group members ─────────────────────────────────────────────────

  it('should list all group members with pagination', async () => {
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Members Group', '', undefined),
    );

    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));
    await joinGroupHandler.execute(new JoinGroupCommand(userId2, group.id.value));

    const result = await getGroupMembersHandler.execute(
      new GetGroupMembersQuery(group.id.value, 1, 20),
    );

    expect(result.total).toBe(3); // owner + 2 members
    expect(result.items).toHaveLength(3);
  });

  // ── Full lifecycle test ───────────────────────────────────────────────

  it('should complete full group lifecycle: create -> join -> promote -> leave -> delete', async () => {
    // 1. Create
    const group = await createGroupHandler.execute(
      new CreateGroupCommand(ownerId, 'Lifecycle Group', 'Full lifecycle test', undefined),
    );

    // 2. Join
    await joinGroupHandler.execute(new JoinGroupCommand(userId, group.id.value));

    // 3. Promote to ADMIN
    const promoted = await updateMemberRoleHandler.execute(
      new UpdateMemberRoleCommand(ownerId, group.id.value, userId, 'ADMIN'),
    );
    expect(promoted.role).toBe('ADMIN');

    // 4. Verify members
    const members = await getGroupMembersHandler.execute(
      new GetGroupMembersQuery(group.id.value, 1, 20),
    );
    expect(members.total).toBe(2);

    // 5. User leaves
    await leaveGroupHandler.execute(new LeaveGroupCommand(userId, group.id.value));

    // 6. Owner deletes
    await deleteGroupHandler.execute(
      new DeleteGroupCommand(ownerId, group.id.value),
    );
  });
});
