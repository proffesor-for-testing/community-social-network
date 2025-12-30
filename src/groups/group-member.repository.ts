/**
 * Group Member Repository
 * Data access layer for group membership
 */

import { Pool } from 'pg';

export interface GroupMemberRepositoryConfig {
  pool: Pool;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  joinedAt: Date;
}

export class GroupMemberRepository {
  private pool: Pool;

  constructor(config: GroupMemberRepositoryConfig) {
    this.pool = config.pool;
  }

  /**
   * Get list of group IDs that a user is a member of
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const query = `
      SELECT group_id AS "groupId"
      FROM group_members
      WHERE user_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => row.groupId);
  }

  /**
   * Check if a user is a member of a group
   */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1
      FROM group_members
      WHERE group_id = $1 AND user_id = $2 AND status = 'active'
      LIMIT 1
    `;

    const result = await this.pool.query(query, [groupId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get a user's membership in a group
   */
  async getMembership(
    groupId: string,
    userId: string
  ): Promise<GroupMember | null> {
    const query = `
      SELECT
        group_id AS "groupId",
        user_id AS "userId",
        role,
        status,
        joined_at AS "joinedAt"
      FROM group_members
      WHERE group_id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [groupId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Add a user to a group
   */
  async create(
    groupId: string,
    userId: string,
    role: 'owner' | 'moderator' | 'member' = 'member'
  ): Promise<GroupMember> {
    const query = `
      INSERT INTO group_members (group_id, user_id, role, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING
        group_id AS "groupId",
        user_id AS "userId",
        role,
        status,
        joined_at AS "joinedAt"
    `;

    const result = await this.pool.query(query, [groupId, userId, role]);
    return result.rows[0];
  }

  /**
   * Remove a user from a group
   */
  async delete(groupId: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM group_members
      WHERE group_id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [groupId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update member's role
   */
  async updateRole(
    groupId: string,
    userId: string,
    role: 'owner' | 'moderator' | 'member'
  ): Promise<GroupMember> {
    const query = `
      UPDATE group_members
      SET role = $3
      WHERE group_id = $1 AND user_id = $2
      RETURNING
        group_id AS "groupId",
        user_id AS "userId",
        role,
        status,
        joined_at AS "joinedAt"
    `;

    const result = await this.pool.query(query, [groupId, userId, role]);
    return result.rows[0];
  }

  /**
   * Update member's status (ban/unban)
   */
  async updateStatus(
    groupId: string,
    userId: string,
    status: 'active' | 'pending' | 'banned'
  ): Promise<GroupMember> {
    const query = `
      UPDATE group_members
      SET status = $3
      WHERE group_id = $1 AND user_id = $2
      RETURNING
        group_id AS "groupId",
        user_id AS "userId",
        role,
        status,
        joined_at AS "joinedAt"
    `;

    const result = await this.pool.query(query, [groupId, userId, status]);
    return result.rows[0];
  }

  /**
   * Get member count for a group
   */
  async getMemberCount(groupId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM group_members
      WHERE group_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [groupId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get members of a group with pagination
   */
  async getMembers(
    groupId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GroupMember[]> {
    const query = `
      SELECT
        group_id AS "groupId",
        user_id AS "userId",
        role,
        status,
        joined_at AS "joinedAt"
      FROM group_members
      WHERE group_id = $1 AND status = 'active'
      ORDER BY
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'moderator' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [groupId, limit, offset]);
    return result.rows;
  }
}
