/**
 * Feed Repository
 * Data access layer for feed queries with optimized SQL
 */

import { Pool } from 'pg';
import { FeedItem, FeedQuery } from './types';

export interface FeedRepositoryConfig {
  pool: Pool;
}

export class FeedRepository {
  private pool: Pool;

  constructor(config: FeedRepositoryConfig) {
    this.pool = config.pool;
  }

  /**
   * Get home feed for a user
   * Posts from followed users and joined groups
   * Uses cursor-based pagination
   */
  async getHomeFeed(query: FeedQuery): Promise<FeedItem[]> {
    const { userId, followingIds, groupIds, cursor, limit } = query;

    // Handle empty following and groups
    if (
      (!followingIds || followingIds.length === 0) &&
      (!groupIds || groupIds.length === 0)
    ) {
      return [];
    }

    const cursorTimestamp = cursor || new Date();
    const values: unknown[] = [];
    let paramIndex = 1;

    // Build the WHERE clause for following IDs
    let followingCondition = '';
    if (followingIds && followingIds.length > 0) {
      followingCondition = `p.author_id = ANY($${paramIndex++})`;
      values.push(followingIds);
    }

    // Build the WHERE clause for group IDs
    let groupCondition = '';
    if (groupIds && groupIds.length > 0) {
      groupCondition = `p.group_id = ANY($${paramIndex++})`;
      values.push(groupIds);
    }

    // Combine conditions
    let sourceCondition = '';
    if (followingCondition && groupCondition) {
      sourceCondition = `(${followingCondition} OR ${groupCondition})`;
    } else if (followingCondition) {
      sourceCondition = followingCondition;
    } else {
      sourceCondition = groupCondition;
    }

    values.push(cursorTimestamp);
    const cursorParamIndex = paramIndex++;

    values.push(limit);
    const limitParamIndex = paramIndex++;

    const sql = `
      SELECT
        p.id,
        p.author_id AS "authorId",
        p.content,
        p.group_id AS "groupId",
        p.visibility,
        p.status,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.shares_count AS "sharesCount",
        p.is_pinned AS "isPinned",
        p.is_deleted AS "isDeleted",
        p.media_urls AS "mediaUrls",
        json_build_object(
          'id', u.id,
          'username', u.username,
          'profilePictureUrl', u.profile_picture_url
        ) AS author,
        CASE
          WHEN g.id IS NOT NULL THEN json_build_object('id', g.id, 'name', g.name)
          ELSE NULL
        END AS group,
        (p.likes_count + p.comments_count * 2) AS "engagementScore"
      FROM posts p
      INNER JOIN users u ON p.author_id = u.id
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE
        p.status = 'published'
        AND p.is_deleted = false
        AND p.created_at < $${cursorParamIndex}
        AND ${sourceCondition}
      ORDER BY
        p.is_pinned DESC,
        p.created_at DESC
      LIMIT $${limitParamIndex}
    `;

    const result = await this.pool.query(sql, values);
    return result.rows;
  }

  /**
   * Get group feed
   * Posts from a specific group
   */
  async getGroupFeed(query: FeedQuery): Promise<FeedItem[]> {
    const { groupId, cursor, limit } = query;
    const cursorTimestamp = cursor || new Date();

    const sql = `
      SELECT
        p.id,
        p.author_id AS "authorId",
        p.content,
        p.group_id AS "groupId",
        p.visibility,
        p.status,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.shares_count AS "sharesCount",
        p.is_pinned AS "isPinned",
        p.is_deleted AS "isDeleted",
        p.media_urls AS "mediaUrls",
        json_build_object(
          'id', u.id,
          'username', u.username,
          'profilePictureUrl', u.profile_picture_url
        ) AS author,
        json_build_object('id', g.id, 'name', g.name) AS group,
        (p.likes_count + p.comments_count * 2) AS "engagementScore"
      FROM posts p
      INNER JOIN users u ON p.author_id = u.id
      INNER JOIN groups g ON p.group_id = g.id
      WHERE
        p.group_id = $1
        AND p.status = 'published'
        AND p.is_deleted = false
        AND p.created_at < $2
      ORDER BY
        p.is_pinned DESC,
        p.created_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(sql, [groupId, cursorTimestamp, limit]);
    return result.rows;
  }

  /**
   * Get user profile feed
   * Posts from a specific user
   */
  async getUserProfileFeed(query: FeedQuery): Promise<FeedItem[]> {
    const { userId, cursor, limit } = query;
    const cursorTimestamp = cursor || new Date();

    const sql = `
      SELECT
        p.id,
        p.author_id AS "authorId",
        p.content,
        p.group_id AS "groupId",
        p.visibility,
        p.status,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        p.likes_count AS "likesCount",
        p.comments_count AS "commentsCount",
        p.shares_count AS "sharesCount",
        p.is_pinned AS "isPinned",
        p.is_deleted AS "isDeleted",
        p.media_urls AS "mediaUrls",
        json_build_object(
          'id', u.id,
          'username', u.username,
          'profilePictureUrl', u.profile_picture_url
        ) AS author,
        CASE
          WHEN g.id IS NOT NULL THEN json_build_object('id', g.id, 'name', g.name)
          ELSE NULL
        END AS group,
        (p.likes_count + p.comments_count * 2) AS "engagementScore"
      FROM posts p
      INNER JOIN users u ON p.author_id = u.id
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE
        p.author_id = $1
        AND p.status = 'published'
        AND p.is_deleted = false
        AND p.visibility IN ('public', 'group')
        AND p.created_at < $2
      ORDER BY
        p.is_pinned DESC,
        p.created_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(sql, [userId, cursorTimestamp, limit]);
    return result.rows;
  }
}
