/**
 * GroupService Unit Tests - TDD London School (Mockist Approach)
 * M5 Groups & RBAC - RED-GREEN-REFACTOR Cycle
 *
 * Test-first approach: Write failing tests, then implement to pass
 */

import { GroupService } from '../../../src/groups/group.service';
import { RBACService } from '../../../src/groups/rbac.service';
import { MembershipService } from '../../../src/groups/membership.service';
import {
  Group,
  GroupMember,
  CreateGroupDTO,
  GroupPrivacy,
  GroupRole,
  MembershipRequest,
  AuthenticatedUser,
} from '../../../src/groups/group.types';

// Mock dependencies - London School approach
const mockGroupRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  incrementMemberCount: jest.fn(),
  decrementMemberCount: jest.fn(),
};

const mockMemberRepository = {
  create: jest.fn(),
  findByGroupAndUser: jest.fn(),
  findByGroup: jest.fn(),
  findByUser: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  countByGroup: jest.fn(),
};

const mockRequestRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findPendingByGroupAndUser: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAuditLogger = {
  log: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deletePattern: jest.fn(),
};

describe('GroupService', () => {
  let groupService: GroupService;
  let rbacService: RBACService;
  let membershipService: MembershipService;

  // Test fixtures
  const testUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const testGroup: Group = {
    id: 'group-456',
    name: 'Test Group',
    description: 'A test group',
    privacy: 'public',
    status: 'active',
    ownerId: testUser.id,
    requirePostApproval: false,
    requireMemberApproval: false,
    memberCount: 1,
    postCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  const testMember: GroupMember = {
    id: 'member-789',
    groupId: testGroup.id,
    userId: testUser.id,
    role: 'owner',
    status: 'active',
    mutedUntil: null,
    muteReason: null,
    bannedUntil: null,
    banReason: null,
    joinedAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize services with mocked dependencies
    rbacService = new RBACService(mockMemberRepository, mockCache);
    membershipService = new MembershipService(
      mockMemberRepository,
      mockRequestRepository,
      mockGroupRepository,
      mockAuditLogger
    );
    groupService = new GroupService(
      mockGroupRepository,
      mockMemberRepository,
      rbacService,
      membershipService,
      mockAuditLogger
    );
  });

  describe('Create Group', () => {
    it('should create a group successfully for authenticated user', async () => {
      // Arrange
      const createGroupDTO: CreateGroupDTO = {
        name: 'New Group',
        description: 'A brand new group',
        privacy: 'public',
      };

      const expectedGroup: Group = {
        id: 'new-group-id',
        name: createGroupDTO.name,
        description: createGroupDTO.description!,
        privacy: createGroupDTO.privacy,
        status: 'active',
        ownerId: testUser.id,
        requirePostApproval: false,
        requireMemberApproval: false,
        memberCount: 1,
        postCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      mockGroupRepository.findByName.mockResolvedValue(null); // Name not taken
      mockGroupRepository.create.mockResolvedValue(expectedGroup);
      mockMemberRepository.create.mockResolvedValue({
        id: 'member-id',
        groupId: expectedGroup.id,
        userId: testUser.id,
        role: 'owner',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await groupService.createGroup(createGroupDTO, testUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(createGroupDTO.name);
      expect(result.ownerId).toBe(testUser.id);
      expect(mockGroupRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createGroupDTO.name,
          ownerId: testUser.id,
        })
      );
    });

    it('should assign creator as owner when creating a group', async () => {
      // Arrange
      const createGroupDTO: CreateGroupDTO = {
        name: 'Owner Test Group',
        privacy: 'private',
      };

      const createdGroup: Group = {
        id: 'owner-group-id',
        name: createGroupDTO.name,
        description: null,
        privacy: createGroupDTO.privacy,
        status: 'active',
        ownerId: testUser.id,
        requirePostApproval: false,
        requireMemberApproval: false,
        memberCount: 1,
        postCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      mockGroupRepository.findByName.mockResolvedValue(null);
      mockGroupRepository.create.mockResolvedValue(createdGroup);
      mockMemberRepository.create.mockResolvedValue({
        id: 'owner-member-id',
        groupId: createdGroup.id,
        userId: testUser.id,
        role: 'owner',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await groupService.createGroup(createGroupDTO, testUser);

      // Assert - Verify owner membership was created
      expect(mockMemberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: createdGroup.id,
          userId: testUser.id,
          role: 'owner',
          status: 'active',
        })
      );
    });

    it('should throw error when group name already exists', async () => {
      // Arrange
      const createGroupDTO: CreateGroupDTO = {
        name: 'Existing Group',
        privacy: 'public',
      };

      mockGroupRepository.findByName.mockResolvedValue(testGroup);

      // Act & Assert
      await expect(
        groupService.createGroup(createGroupDTO, testUser)
      ).rejects.toThrow('Group name already exists');
    });
  });

  describe('Join Group', () => {
    it('should allow joining a public group immediately', async () => {
      // Arrange
      const publicGroup: Group = {
        ...testGroup,
        privacy: 'public',
        requireMemberApproval: false,
      };

      const joiningUser: AuthenticatedUser = {
        id: 'joining-user-id',
        email: 'joiner@example.com',
        name: 'Joining User',
      };

      mockGroupRepository.findById.mockResolvedValue(publicGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(null); // Not already a member
      mockMemberRepository.create.mockResolvedValue({
        id: 'new-member-id',
        groupId: publicGroup.id,
        userId: joiningUser.id,
        role: 'member',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      });
      mockGroupRepository.incrementMemberCount.mockResolvedValue(undefined);

      // Act
      const result = await groupService.joinGroup(publicGroup.id, joiningUser);

      // Assert
      expect(result.success).toBe(true);
      expect(result.membership).toBeDefined();
      expect(result.membership?.role).toBe('member');
      expect(result.membership?.status).toBe('active');
      expect(mockMemberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: publicGroup.id,
          userId: joiningUser.id,
          role: 'member',
        })
      );
    });

    it('should create pending request when joining a private group', async () => {
      // Arrange
      const privateGroup: Group = {
        ...testGroup,
        privacy: 'private',
        requireMemberApproval: true,
      };

      const joiningUser: AuthenticatedUser = {
        id: 'joining-user-id',
        email: 'joiner@example.com',
        name: 'Joining User',
      };

      const pendingRequest: MembershipRequest = {
        id: 'request-id',
        groupId: privateGroup.id,
        userId: joiningUser.id,
        status: 'pending',
        answers: null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      mockGroupRepository.findById.mockResolvedValue(privateGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(null);
      mockRequestRepository.findPendingByGroupAndUser.mockResolvedValue(null);
      mockRequestRepository.create.mockResolvedValue(pendingRequest);

      // Act
      const result = await groupService.joinGroup(privateGroup.id, joiningUser);

      // Assert
      expect(result.success).toBe(true);
      expect(result.request).toBeDefined();
      expect(result.request?.status).toBe('pending');
      expect(result.message).toContain('pending');
      expect(mockRequestRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: privateGroup.id,
          userId: joiningUser.id,
          status: 'pending',
        })
      );
    });

    it('should reject joining if already a member', async () => {
      // Arrange
      mockGroupRepository.findById.mockResolvedValue(testGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(testMember);

      // Act & Assert
      await expect(
        groupService.joinGroup(testGroup.id, testUser)
      ).rejects.toThrow('Already a member of this group');
    });

    it('should reject joining non-existent group', async () => {
      // Arrange
      mockGroupRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        groupService.joinGroup('non-existent-id', testUser)
      ).rejects.toThrow('Group not found');
    });
  });

  describe('Role Management', () => {
    it('should allow owner to promote member to moderator', async () => {
      // Arrange
      const memberToPromote: GroupMember = {
        id: 'member-to-promote',
        groupId: testGroup.id,
        userId: 'target-user-id',
        role: 'member',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const ownerMember: GroupMember = {
        ...testMember,
        role: 'owner',
      };

      mockGroupRepository.findById.mockResolvedValue(testGroup);
      mockMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce(ownerMember) // Actor check
        .mockResolvedValueOnce(memberToPromote); // Target check
      mockMemberRepository.update.mockResolvedValue({
        ...memberToPromote,
        role: 'moderator',
      });
      mockCache.delete.mockResolvedValue(undefined);

      // Act
      const result = await groupService.assignRole(
        testGroup.id,
        'target-user-id',
        'moderator',
        testUser
      );

      // Assert
      expect(result.role).toBe('moderator');
      expect(mockMemberRepository.update).toHaveBeenCalledWith(
        memberToPromote.id,
        expect.objectContaining({ role: 'moderator' })
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role_assigned',
          groupId: testGroup.id,
          targetUserId: 'target-user-id',
        })
      );
    });

    it('should reject role assignment from non-owner', async () => {
      // Arrange
      const moderatorMember: GroupMember = {
        ...testMember,
        role: 'moderator',
      };

      mockGroupRepository.findById.mockResolvedValue(testGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(moderatorMember);

      // Act & Assert
      await expect(
        groupService.assignRole(testGroup.id, 'target-user-id', 'moderator', testUser)
      ).rejects.toThrow('Only owner can assign roles');
    });

    it('should not allow promoting to owner role', async () => {
      // Arrange
      const ownerMember: GroupMember = {
        ...testMember,
        role: 'owner',
      };

      mockGroupRepository.findById.mockResolvedValue(testGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(ownerMember);

      // Act & Assert
      await expect(
        groupService.assignRole(testGroup.id, 'target-user-id', 'owner', testUser)
      ).rejects.toThrow('Cannot assign owner role directly');
    });
  });

  describe('Moderation Actions', () => {
    it('should allow moderator to remove posts but not members', async () => {
      // Arrange
      const moderatorMember: GroupMember = {
        id: 'mod-member-id',
        groupId: testGroup.id,
        userId: 'moderator-user-id',
        role: 'moderator',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const moderatorUser: AuthenticatedUser = {
        id: 'moderator-user-id',
        email: 'mod@example.com',
        name: 'Moderator',
      };

      mockMemberRepository.findByGroupAndUser.mockResolvedValue(moderatorMember);

      // Act - Check moderator can delete posts
      const canDeletePost = await rbacService.checkPermission(
        moderatorUser.id,
        testGroup.id,
        'delete_post'
      );

      // Assert
      expect(canDeletePost.allowed).toBe(true);

      // Act - Check moderator cannot remove moderators
      const canRemoveModerator = await rbacService.checkPermission(
        moderatorUser.id,
        testGroup.id,
        'assign_moderator'
      );

      // Assert
      expect(canRemoveModerator.allowed).toBe(false);
    });
  });

  describe('Privacy Enforcement', () => {
    it('should deny non-member access to private group content', async () => {
      // Arrange
      const privateGroup: Group = {
        ...testGroup,
        privacy: 'private',
      };

      const nonMemberUser: AuthenticatedUser = {
        id: 'non-member-id',
        email: 'outsider@example.com',
        name: 'Outsider',
      };

      mockGroupRepository.findById.mockResolvedValue(privateGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(null); // Not a member

      // Act
      const canAccess = await groupService.canAccessGroupContent(
        privateGroup.id,
        nonMemberUser
      );

      // Assert
      expect(canAccess).toBe(false);
    });

    it('should allow member access to private group content', async () => {
      // Arrange
      const privateGroup: Group = {
        ...testGroup,
        privacy: 'private',
      };

      const memberOfGroup: GroupMember = {
        ...testMember,
        groupId: privateGroup.id,
        role: 'member',
      };

      mockGroupRepository.findById.mockResolvedValue(privateGroup);
      mockMemberRepository.findByGroupAndUser.mockResolvedValue(memberOfGroup);

      // Act
      const canAccess = await groupService.canAccessGroupContent(
        privateGroup.id,
        testUser
      );

      // Assert
      expect(canAccess).toBe(true);
    });

    it('should allow anyone to view public group content', async () => {
      // Arrange
      const publicGroup: Group = {
        ...testGroup,
        privacy: 'public',
      };

      const anyUser: AuthenticatedUser = {
        id: 'random-user-id',
        email: 'random@example.com',
        name: 'Random User',
      };

      mockGroupRepository.findById.mockResolvedValue(publicGroup);

      // Act
      const canAccess = await groupService.canAccessGroupContent(
        publicGroup.id,
        anyUser
      );

      // Assert
      expect(canAccess).toBe(true);
    });
  });

  describe('Member Banning', () => {
    it('should allow moderator to ban a regular member', async () => {
      // Arrange
      const moderatorMember: GroupMember = {
        ...testMember,
        userId: 'moderator-user-id',
        role: 'moderator',
      };

      const targetMember: GroupMember = {
        id: 'target-member-id',
        groupId: testGroup.id,
        userId: 'target-user-id',
        role: 'member',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const moderatorUser: AuthenticatedUser = {
        id: 'moderator-user-id',
        email: 'mod@example.com',
        name: 'Moderator',
      };

      mockGroupRepository.findById.mockResolvedValue(testGroup);
      // RBAC check calls findByGroupAndUser for permission check
      // Then banMember calls it again for actor, then for target
      mockMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce(moderatorMember) // RBAC permission check
        .mockResolvedValueOnce(moderatorMember) // Actor check in banMember
        .mockResolvedValueOnce(targetMember); // Target check
      mockMemberRepository.update.mockResolvedValue({
        ...targetMember,
        status: 'banned',
        banReason: 'Violation of community guidelines',
      });
      mockCache.get.mockResolvedValue(null); // Cache miss for RBAC
      mockCache.set.mockResolvedValue(undefined);
      mockCache.delete.mockResolvedValue(undefined);

      // Act
      const result = await groupService.banMember(
        testGroup.id,
        'target-user-id',
        'Violation of community guidelines',
        moderatorUser
      );

      // Assert
      expect(result.status).toBe('banned');
      expect(result.banReason).toBe('Violation of community guidelines');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'member_banned',
          groupId: testGroup.id,
          targetUserId: 'target-user-id',
        })
      );
    });

    it('should prevent moderator from banning another moderator', async () => {
      // Arrange
      const moderatorMember: GroupMember = {
        ...testMember,
        userId: 'moderator-user-id',
        role: 'moderator',
      };

      const targetModerator: GroupMember = {
        id: 'target-mod-id',
        groupId: testGroup.id,
        userId: 'target-mod-user-id',
        role: 'moderator',
        status: 'active',
        mutedUntil: null,
        muteReason: null,
        bannedUntil: null,
        banReason: null,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const moderatorUser: AuthenticatedUser = {
        id: 'moderator-user-id',
        email: 'mod@example.com',
        name: 'Moderator',
      };

      mockGroupRepository.findById.mockResolvedValue(testGroup);
      // RBAC check calls findByGroupAndUser for permission check
      // Then banMember calls it for actor, then for target
      mockMemberRepository.findByGroupAndUser
        .mockResolvedValueOnce(moderatorMember) // RBAC permission check
        .mockResolvedValueOnce(moderatorMember) // Actor check
        .mockResolvedValueOnce(targetModerator); // Target check
      mockCache.get.mockResolvedValue(null); // Cache miss for RBAC
      mockCache.set.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        groupService.banMember(
          testGroup.id,
          'target-mod-user-id',
          'Test reason',
          moderatorUser
        )
      ).rejects.toThrow('Cannot ban a moderator or owner');
    });
  });
});
