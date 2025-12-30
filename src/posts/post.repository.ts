/**
 * Post Repository
 * Data access layer for posts using PostgreSQL
 */

import { Pool } from 'pg';
import {
  Post,
  CreatePostInput,
  UpdatePostInput,
  PostWithAuthor,
} from './types';

export interface PostRepositoryConfig {
  pool: Pool;
}

export class PostRepository {
  private pool: Pool;

  constructor(config: PostRepositoryConfig) {
    this.pool = config.pool;
  }

  /**
   * Create a new post
   */
  async create(input: CreatePostInput): Promise<Post> {
    const query = `
      INSERT INTO posts (
        author_id,
        content,
        group_id,
        visibility,
        status,
        scheduled_at,
        media_urls,
        likes_count,
        comments_count,
        shares_count,
        is_pinned,
        is_deleted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, false, false)
      RETURNING
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
    `;

    const values = [
      input.authorId,
      input.content,
      input.groupId || null,
      input.visibility || 'public',
      input.scheduledAt ? 'scheduled' : 'published',
      input.scheduledAt || null,
      input.mediaUrls || [],
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find post by ID
   */
  async findById(id: string): Promise<Post | null> {
    const query = `
      SELECT
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
      FROM posts
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find post by ID with author information
   */
  async findByIdWithAuthor(id: string): Promise<PostWithAuthor | null> {
    const query = `
      SELECT
        p.id,
        p.author_id AS "authorId",
        p.content,
        p.group_id AS "groupId",
        p.visibility,
        p.status,
        p.scheduled_at AS "scheduledAt",
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
        END AS group
      FROM posts p
      INNER JOIN users u ON p.author_id = u.id
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE p.id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Update a post
   */
  async update(id: string, input: UpdatePostInput): Promise<Post> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(input.content);
    }

    if (input.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(input.visibility);
    }

    if (input.mediaUrls !== undefined) {
      updates.push(`media_urls = $${paramIndex++}`);
      values.push(input.mediaUrls);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE posts
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Soft delete a post
   */
  async softDelete(id: string): Promise<Post> {
    const query = `
      UPDATE posts
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find posts by author
   */
  async findByAuthor(
    authorId: string,
    limit: number = 20,
    cursor?: Date
  ): Promise<Post[]> {
    const query = `
      SELECT
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
      FROM posts
      WHERE author_id = $1
        AND is_deleted = false
        AND status = 'published'
        ${cursor ? 'AND created_at < $3' : ''}
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const values = cursor ? [authorId, limit, cursor] : [authorId, limit];
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Find posts by group
   */
  async findByGroup(
    groupId: string,
    limit: number = 20,
    cursor?: Date
  ): Promise<Post[]> {
    const query = `
      SELECT
        id,
        author_id AS "authorId",
        content,
        group_id AS "groupId",
        visibility,
        status,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        shares_count AS "sharesCount",
        is_pinned AS "isPinned",
        is_deleted AS "isDeleted",
        media_urls AS "mediaUrls"
      FROM posts
      WHERE group_id = $1
        AND is_deleted = false
        AND status = 'published'
        ${cursor ? 'AND created_at < $3' : ''}
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT $2
    `;

    const values = cursor ? [groupId, limit, cursor] : [groupId, limit];
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Increment likes count
   */
  async incrementLikesCount(id: string): Promise<void> {
    const query = `
      UPDATE posts
      SET likes_count = likes_count + 1
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }

  /**
   * Decrement likes count
   */
  async decrementLikesCount(id: string): Promise<void> {
    const query = `
      UPDATE posts
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }

  /**
   * Increment comments count
   */
  async incrementCommentsCount(id: string): Promise<void> {
    const query = `
      UPDATE posts
      SET comments_count = comments_count + 1
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }

  /**
   * Decrement comments count
   */
  async decrementCommentsCount(id: string): Promise<void> {
    const query = `
      UPDATE posts
      SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }
}
