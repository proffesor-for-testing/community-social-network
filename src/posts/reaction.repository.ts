/**
 * Reaction Repository
 * Data access layer for post reactions
 */

import { Pool } from 'pg';
import { Reaction, ReactionType, ReactionCounts } from './types';

export interface ReactionRepositoryConfig {
  pool: Pool;
}

export class ReactionRepository {
  private pool: Pool;

  constructor(config: ReactionRepositoryConfig) {
    this.pool = config.pool;
  }

  /**
   * Find reaction by user and post
   */
  async findByUserAndPost(
    userId: string,
    postId: string
  ): Promise<Reaction | null> {
    const query = `
      SELECT
        id,
        user_id AS "userId",
        post_id AS "postId",
        reaction_type AS "type",
        created_at AS "createdAt"
      FROM reactions
      WHERE user_id = $1 AND post_id = $2
    `;

    const result = await this.pool.query(query, [userId, postId]);
    return result.rows[0] || null;
  }

  /**
   * Get user's reaction for a post
   */
  async getUserReaction(
    userId: string,
    postId: string
  ): Promise<Reaction | null> {
    return this.findByUserAndPost(userId, postId);
  }

  /**
   * Upsert a reaction (insert or update)
   */
  async upsert(input: {
    userId: string;
    postId: string;
    type: ReactionType;
  }): Promise<Reaction> {
    const query = `
      INSERT INTO reactions (user_id, post_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, post_id)
      DO UPDATE SET reaction_type = EXCLUDED.reaction_type
      RETURNING
        id,
        user_id AS "userId",
        post_id AS "postId",
        reaction_type AS "type",
        created_at AS "createdAt"
    `;

    const result = await this.pool.query(query, [
      input.userId,
      input.postId,
      input.type,
    ]);
    return result.rows[0];
  }

  /**
   * Delete a reaction
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM reactions WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get reaction counts for a post
   */
  async getReactionCounts(postId: string): Promise<ReactionCounts> {
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END), 0) AS like,
        COALESCE(SUM(CASE WHEN reaction_type = 'love' THEN 1 ELSE 0 END), 0) AS love,
        COALESCE(SUM(CASE WHEN reaction_type = 'laugh' THEN 1 ELSE 0 END), 0) AS laugh,
        COALESCE(SUM(CASE WHEN reaction_type = 'wow' THEN 1 ELSE 0 END), 0) AS wow,
        COALESCE(SUM(CASE WHEN reaction_type = 'sad' THEN 1 ELSE 0 END), 0) AS sad,
        COALESCE(SUM(CASE WHEN reaction_type = 'angry' THEN 1 ELSE 0 END), 0) AS angry,
        COUNT(*) AS total
      FROM reactions
      WHERE post_id = $1
    `;

    const result = await this.pool.query(query, [postId]);
    const row = result.rows[0];

    return {
      like: parseInt(row.like, 10),
      love: parseInt(row.love, 10),
      laugh: parseInt(row.laugh, 10),
      wow: parseInt(row.wow, 10),
      sad: parseInt(row.sad, 10),
      angry: parseInt(row.angry, 10),
      total: parseInt(row.total, 10),
    };
  }

  /**
   * Get reactions for a post with pagination
   */
  async getReactionsForPost(
    postId: string,
    type?: ReactionType,
    limit: number = 20,
    offset: number = 0
  ): Promise<Reaction[]> {
    let query = `
      SELECT
        id,
        user_id AS "userId",
        post_id AS "postId",
        reaction_type AS "type",
        created_at AS "createdAt"
      FROM reactions
      WHERE post_id = $1
    `;

    const values: unknown[] = [postId];

    if (type) {
      query += ` AND reaction_type = $2`;
      values.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}
