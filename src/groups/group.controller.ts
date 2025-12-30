/**
 * Group Controller - HTTP Request Handlers
 * M5 Groups & RBAC - REST API Layer
 */

import { Request, Response, NextFunction } from 'express';
import { GroupService } from './group.service';
import {
  CreateGroupDTO,
  UpdateGroupDTO,
  GroupPrivacy,
  AuthenticatedUser,
} from './group.types';

// Extended request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class GroupController {
  constructor(private groupService: GroupService) {}

  /**
   * Create a new group
   * POST /groups
   */
  async createGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const dto: CreateGroupDTO = {
        name: req.body.name,
        description: req.body.description,
        privacy: req.body.privacy as GroupPrivacy,
        requirePostApproval: req.body.requirePostApproval,
        requireMemberApproval: req.body.requireMemberApproval,
      };

      // Validate required fields
      if (!dto.name || !dto.privacy) {
        res.status(400).json({ error: 'Name and privacy are required' });
        return;
      }

      const group = await this.groupService.createGroup(dto, req.user);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof Error && error.message === 'Group name already exists') {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * Get group by ID
   * GET /groups/:groupId
   */
  async getGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { groupId } = req.params;
      const group = await this.groupService.getGroup(groupId);

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      // Check access for private groups
      if (group.privacy !== 'public') {
        const canAccess = await this.groupService.canAccessGroupContent(
          groupId,
          req.user || null
        );
        if (!canAccess) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      res.json(group);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List groups
   * GET /groups
   */
  async listGroups(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { privacy, page, limit } = req.query;

      const groups = await this.groupService.listGroups({
        privacy: privacy as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({ groups, total: groups.length });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update group
   * PATCH /groups/:groupId
   */
  async updateGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId } = req.params;
      const dto: UpdateGroupDTO = {
        name: req.body.name,
        description: req.body.description,
        privacy: req.body.privacy,
        requirePostApproval: req.body.requirePostApproval,
        requireMemberApproval: req.body.requireMemberApproval,
      };

      const group = await this.groupService.updateGroup(groupId, dto, req.user);
      res.json(group);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === 'Group name already exists') {
          res.status(409).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Delete group
   * DELETE /groups/:groupId
   */
  async deleteGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId } = req.params;
      await this.groupService.deleteGroup(groupId, req.user);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * Join group
   * POST /groups/:groupId/members
   */
  async joinGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId } = req.params;
      const result = await this.groupService.joinGroup(groupId, req.user);

      const statusCode = result.request ? 202 : 201;
      res.status(statusCode).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Group not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message === 'Already a member of this group') {
          res.status(409).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Leave group
   * DELETE /groups/:groupId/members/me
   */
  async leaveGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId } = req.params;
      await this.groupService.leaveGroup(groupId, req.user);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Not a member of this group') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('Owner cannot leave')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Get group members
   * GET /groups/:groupId/members
   */
  async getMembers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { groupId } = req.params;

      // Check access
      const canAccess = await this.groupService.canAccessGroupContent(
        groupId,
        req.user || null
      );
      if (!canAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const members = await this.groupService.getGroupMembers(groupId);
      res.json({ members, total: members.length });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove member
   * DELETE /groups/:groupId/members/:userId
   */
  async removeMember(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Implementation would use membershipService.removeMember
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign role to member
   * PATCH /groups/:groupId/members/:userId/role
   */
  async assignRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId, userId } = req.params;
      const { role } = req.body;

      if (!role || !['moderator', 'member'].includes(role)) {
        res.status(400).json({ error: 'Valid role (moderator or member) is required' });
        return;
      }

      const member = await this.groupService.assignRole(
        groupId,
        userId,
        role,
        req.user
      );
      res.json(member);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only owner')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not a member')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Ban member
   * POST /groups/:groupId/members/:userId/ban
   */
  async banMember(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId, userId } = req.params;
      const { reason, duration } = req.body;

      if (!reason) {
        res.status(400).json({ error: 'Reason is required' });
        return;
      }

      const member = await this.groupService.banMember(
        groupId,
        userId,
        reason,
        req.user,
        duration
      );
      res.json(member);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('Cannot ban')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Mute member
   * POST /groups/:groupId/members/:userId/mute
   */
  async muteMember(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId, userId } = req.params;
      const { reason, duration } = req.body;

      if (!reason || !duration) {
        res.status(400).json({ error: 'Reason and duration are required' });
        return;
      }

      const member = await this.groupService.muteMember(
        groupId,
        userId,
        reason,
        req.user,
        duration
      );
      res.json(member);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('Cannot mute')) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * Transfer ownership
   * POST /groups/:groupId/transfer-ownership
   */
  async transferOwnership(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { groupId } = req.params;
      const { newOwnerId } = req.body;

      if (!newOwnerId) {
        res.status(400).json({ error: 'New owner ID is required' });
        return;
      }

      await this.groupService.transferOwnership(groupId, newOwnerId, req.user);
      res.json({ success: true, message: 'Ownership transferred successfully' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('must be a member')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}
