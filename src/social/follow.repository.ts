/**
 * Follow Repository
 * Data access layer for user follow relationships
 */

import { Pool } from 'pg';

export interface FollowRepositoryConfig {
  pool: Pool;
}

export interface Follow {
  followerId: string;
  followingId: string;
  status: 'active' | 'pending' | 'blocked';
  createdAt: Date;
}

export class FollowRepository {
  private pool: Pool;

  constructor(config: FollowRepositoryConfig) {
    this.pool = config.pool;
  }

  /**
   * Get list of user IDs that a user follows
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const query = `
      SELECT following_id AS "followingId"
      FROM follows
      WHERE follower_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => row.followingId);
  }

  /**
   * Get list of user IDs that follow a user
   */
  async getFollowerIds(userId: string): Promise<string[]> {
    const query = `
      SELECT follower_id AS "followerId"
      FROM follows
      WHERE following_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => row.followerId);
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const query = `
      SELECT 1
      FROM follows
      WHERE follower_id = $1 AND following_id = $2 AND status = 'active'
      LIMIT 1
    `;

    const result = await this.pool.query(query, [followerId, followingId]);
    return result.rows.length > 0;
  }

  /**
   * Create a follow relationship
   */
  async create(followerId: string, followingId: string): Promise<Follow> {
    const query = `
      INSERT INTO follows (follower_id, following_id, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (follower_id, following_id)
      DO UPDATE SET status = 'active'
      RETURNING
        follower_id AS "followerId",
        following_id AS "followingId",
        status,
        created_at AS "createdAt"
    `;

    const result = await this.pool.query(query, [followerId, followingId]);
    return result.rows[0];
  }

  /**
   * Remove a follow relationship
   */
  async delete(followerId: string, followingId: string): Promise<boolean> {
    const query = `
      DELETE FROM follows
      WHERE follower_id = $1 AND following_id = $2
    `;

    const result = await this.pool.query(query, [followerId, followingId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get followers count for a user
   */
  async getFollowersCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM follows
      WHERE following_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get following count for a user
   */
  async getFollowingCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM follows
      WHERE follower_id = $1 AND status = 'active'
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }
}
