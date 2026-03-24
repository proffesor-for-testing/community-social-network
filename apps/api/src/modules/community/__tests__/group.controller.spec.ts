import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  GroupStatus,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';
import { AccessTokenPayload } from '@csn/infra-auth';
import { GroupController } from '../controllers/group.controller';
import { CreateGroupHandler } from '../commands/create-group.handler';
import { UpdateGroupHandler } from '../commands/update-group.handler';
import { DeleteGroupHandler } from '../commands/delete-group.handler';
import { JoinGroupHandler } from '../commands/join-group.handler';
import { LeaveGroupHandler } from '../commands/leave-group.handler';
import { UpdateMemberRoleHandler } from '../commands/update-member-role.handler';
import { KickMemberHandler } from '../commands/kick-member.handler';
import { GetGroupHandler } from '../queries/get-group.handler';
import { GetGroupMembersHandler } from '../queries/get-group-members.handler';
import { SearchGroupsHandler } from '../queries/search-groups.handler';

function createMockGroup(overrides?: Partial<{
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
}>): Group {
  const id = overrides?.id ?? '11111111-1111-1111-1111-111111111111';
  const ownerId = overrides?.ownerId ?? '22222222-2222-2222-2222-222222222222';
  return Group.reconstitute(
    GroupId.create(id),
    GroupName.create(overrides?.name ?? 'Test Group'),
    GroupDescription.create(overrides?.description ?? 'A test group'),
    UserId.create(ownerId),
    GroupSettings.defaults(),
    [],
    GroupStatus.ACTIVE,
    overrides?.memberCount ?? 5,
    Timestamp.fromDate(new Date('2025-01-01T00:00:00.000Z')),
    1,
  );
}

function createMockMembership(overrides?: Partial<{
  id: string;
  groupId: string;
  memberId: string;
  role: MembershipRole;
}>): Membership {
  return Membership.reconstitute(
    MembershipId.create(overrides?.id ?? '33333333-3333-3333-3333-333333333333'),
    GroupId.create(overrides?.groupId ?? '11111111-1111-1111-1111-111111111111'),
    UserId.create(overrides?.memberId ?? '44444444-4444-4444-4444-444444444444'),
    overrides?.role ?? MembershipRole.MEMBER,
    Timestamp.fromDate(new Date('2025-01-01T00:00:00.000Z')),
    1,
  );
}

function createMockUser(userId?: string): AccessTokenPayload {
  return {
    userId: userId ?? '22222222-2222-2222-2222-222222222222',
    email: 'test@example.com',
    roles: ['user'],
    jti: 'test-jti',
    iat: Date.now(),
    exp: Date.now() + 3600,
  };
}

describe('GroupController', () => {
  let controller: GroupController;
  let createGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let updateGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let deleteGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let joinGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let leaveGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let updateMemberRoleHandler: { execute: ReturnType<typeof vi.fn> };
  let kickMemberHandler: { execute: ReturnType<typeof vi.fn> };
  let getGroupHandler: { execute: ReturnType<typeof vi.fn> };
  let getGroupMembersHandler: { execute: ReturnType<typeof vi.fn> };
  let searchGroupsHandler: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    createGroupHandler = { execute: vi.fn() };
    updateGroupHandler = { execute: vi.fn() };
    deleteGroupHandler = { execute: vi.fn() };
    joinGroupHandler = { execute: vi.fn() };
    leaveGroupHandler = { execute: vi.fn() };
    updateMemberRoleHandler = { execute: vi.fn() };
    kickMemberHandler = { execute: vi.fn() };
    getGroupHandler = { execute: vi.fn() };
    getGroupMembersHandler = { execute: vi.fn() };
    searchGroupsHandler = { execute: vi.fn() };

    controller = new GroupController(
      createGroupHandler as unknown as CreateGroupHandler,
      updateGroupHandler as unknown as UpdateGroupHandler,
      deleteGroupHandler as unknown as DeleteGroupHandler,
      joinGroupHandler as unknown as JoinGroupHandler,
      leaveGroupHandler as unknown as LeaveGroupHandler,
      updateMemberRoleHandler as unknown as UpdateMemberRoleHandler,
      kickMemberHandler as unknown as KickMemberHandler,
      getGroupHandler as unknown as GetGroupHandler,
      getGroupMembersHandler as unknown as GetGroupMembersHandler,
      searchGroupsHandler as unknown as SearchGroupsHandler,
    );
  });

  describe('POST /api/groups (createGroup)', () => {
    it('should create a group and return GroupResponseDto', async () => {
      const user = createMockUser();
      const group = createMockGroup({ ownerId: user.userId });
      createGroupHandler.execute.mockResolvedValue(group);

      const result = await controller.createGroup(user, {
        name: 'Test Group',
        description: 'A test group',
      });

      expect(result.id).toBe(group.id.value);
      expect(result.name).toBe('Test Group');
      expect(result.ownerId).toBe(user.userId);
      expect(createGroupHandler.execute).toHaveBeenCalledOnce();
    });

    it('should pass settings when provided', async () => {
      const user = createMockUser();
      const group = createMockGroup({ ownerId: user.userId });
      createGroupHandler.execute.mockResolvedValue(group);

      await controller.createGroup(user, {
        name: 'Test Group',
        settings: { isPublic: false, requireApproval: true, allowMemberPosts: false },
      });

      const callArgs = createGroupHandler.execute.mock.calls[0][0];
      expect(callArgs.settings).toEqual({
        isPublic: false,
        requireApproval: true,
        allowMemberPosts: false,
      });
    });
  });

  describe('GET /api/groups/:id (getGroup)', () => {
    it('should return a group by ID', async () => {
      const group = createMockGroup();
      getGroupHandler.execute.mockResolvedValue(group);

      const result = await controller.getGroup(group.id.value);

      expect(result.id).toBe(group.id.value);
      expect(result.name).toBe('Test Group');
      expect(result.settings.isPublic).toBe(true);
      expect(getGroupHandler.execute).toHaveBeenCalledOnce();
    });

    it('should propagate NotFoundException from handler', async () => {
      getGroupHandler.execute.mockRejectedValue(new NotFoundException('Group not found'));

      await expect(controller.getGroup('11111111-1111-1111-1111-111111111111'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('PUT /api/groups/:id (updateGroup)', () => {
    it('should update group and return updated data', async () => {
      const user = createMockUser();
      const group = createMockGroup({
        name: 'Updated Group',
        ownerId: user.userId,
      });
      updateGroupHandler.execute.mockResolvedValue(group);

      const result = await controller.updateGroup(
        user,
        group.id.value,
        { name: 'Updated Group' },
      );

      expect(result.name).toBe('Updated Group');
      expect(updateGroupHandler.execute).toHaveBeenCalledOnce();
    });

    it('should propagate ForbiddenException for non-owner/admin', async () => {
      const user = createMockUser('55555555-5555-5555-5555-555555555555');
      updateGroupHandler.execute.mockRejectedValue(
        new ForbiddenException('Only owners and admins can update group settings'),
      );

      await expect(
        controller.updateGroup(user, '11111111-1111-1111-1111-111111111111', { name: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DELETE /api/groups/:id (deleteGroup)', () => {
    it('should delete (archive) a group', async () => {
      const user = createMockUser();
      deleteGroupHandler.execute.mockResolvedValue(undefined);

      await controller.deleteGroup(user, '11111111-1111-1111-1111-111111111111');

      expect(deleteGroupHandler.execute).toHaveBeenCalledOnce();
    });

    it('should propagate ForbiddenException for non-owner', async () => {
      const user = createMockUser('55555555-5555-5555-5555-555555555555');
      deleteGroupHandler.execute.mockRejectedValue(
        new ForbiddenException('Only the group owner can delete the group'),
      );

      await expect(
        controller.deleteGroup(user, '11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /api/groups/:id/join (joinGroup)', () => {
    it('should join a group and return MembershipResponseDto', async () => {
      const user = createMockUser();
      const membership = createMockMembership({ memberId: user.userId });
      joinGroupHandler.execute.mockResolvedValue(membership);

      const result = await controller.joinGroup(
        user,
        '11111111-1111-1111-1111-111111111111',
      );

      expect(result.memberId).toBe(user.userId);
      expect(result.role).toBe(MembershipRole.MEMBER);
      expect(joinGroupHandler.execute).toHaveBeenCalledOnce();
    });

    it('should propagate ConflictException if already a member', async () => {
      const user = createMockUser();
      joinGroupHandler.execute.mockRejectedValue(
        new ConflictException('Already a member of this group'),
      );

      await expect(
        controller.joinGroup(user, '11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('POST /api/groups/:id/leave (leaveGroup)', () => {
    it('should leave a group', async () => {
      const user = createMockUser();
      leaveGroupHandler.execute.mockResolvedValue(undefined);

      await controller.leaveGroup(user, '11111111-1111-1111-1111-111111111111');

      expect(leaveGroupHandler.execute).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/groups/:id/members (getGroupMembers)', () => {
    it('should return paginated members', async () => {
      const membership = createMockMembership();
      getGroupMembersHandler.execute.mockResolvedValue({
        items: [membership],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const result = await controller.getGroupMembers(
        '11111111-1111-1111-1111-111111111111',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].memberId).toBe(membership.memberId.value);
      expect(result.total).toBe(1);
    });

    it('should pass pagination params', async () => {
      getGroupMembersHandler.execute.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      });

      await controller.getGroupMembers(
        '11111111-1111-1111-1111-111111111111',
        '2',
        '10',
      );

      const callArgs = getGroupMembersHandler.execute.mock.calls[0][0];
      expect(callArgs.page).toBe(2);
      expect(callArgs.pageSize).toBe(10);
    });
  });

  describe('PUT /api/groups/:id/members/:memberId/role (updateMemberRole)', () => {
    it('should update a member role', async () => {
      const user = createMockUser();
      const membership = createMockMembership({ role: MembershipRole.ADMIN });
      updateMemberRoleHandler.execute.mockResolvedValue(membership);

      const result = await controller.updateMemberRole(
        user,
        '11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444',
        { role: 'ADMIN' as any },
      );

      expect(result.role).toBe(MembershipRole.ADMIN);
      expect(updateMemberRoleHandler.execute).toHaveBeenCalledOnce();
    });
  });

  describe('DELETE /api/groups/:id/members/:memberId (kickMember)', () => {
    it('should kick a member', async () => {
      const user = createMockUser();
      kickMemberHandler.execute.mockResolvedValue(undefined);

      await controller.kickMember(
        user,
        '11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444',
      );

      expect(kickMemberHandler.execute).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/groups/search (searchGroups)', () => {
    it('should search groups with query', async () => {
      const group = createMockGroup();
      searchGroupsHandler.execute.mockResolvedValue({
        items: [group],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const result = await controller.searchGroups({ query: 'Test' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Test Group');
      expect(result.total).toBe(1);
    });

    it('should use defaults when no params provided', async () => {
      searchGroupsHandler.execute.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      await controller.searchGroups({});

      const callArgs = searchGroupsHandler.execute.mock.calls[0][0];
      expect(callArgs.searchQuery).toBe('');
      expect(callArgs.page).toBe(1);
      expect(callArgs.pageSize).toBe(20);
    });
  });
});
