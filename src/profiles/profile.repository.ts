/**
 * Profile Repository - Database operations for User Profiles
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Handles all database interactions for user profiles
 */

import { Pool, QueryResult } from 'pg';
import {
  UserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  ProfileSearchFilters,
  ProfileErrorCodes,
} from './profile.types';

export class ProfileRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: number): Promise<UserProfile | null> {
    const query = `
      SELECT
        id,
        user_id AS "userId",
        display_name AS "displayName",
        bio,
        avatar_url AS "avatarUrl",
        avatar_s3_key AS "avatarS3Key",
        cover_image_url AS "coverImageUrl",
        cover_image_s3_key AS "coverImageS3Key",
        location,
        website,
        is_public AS "isPublic",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_profiles
      WHERE user_id = $1
    `;

    const result: QueryResult = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Find profile by profile ID
   */
  async findById(id: number): Promise<UserProfile | null> {
    const query = `
      SELECT
        id,
        user_id AS "userId",
        display_name AS "displayName",
        bio,
        avatar_url AS "avatarUrl",
        avatar_s3_key AS "avatarS3Key",
        cover_image_url AS "coverImageUrl",
        cover_image_s3_key AS "coverImageS3Key",
        location,
        website,
        is_public AS "isPublic",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_profiles
      WHERE id = $1
    `;

    const result: QueryResult = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new profile
   */
  async create(input: CreateProfileInput): Promise<UserProfile> {
    const query = `
      INSERT INTO user_profiles (
        user_id,
        display_name,
        bio,
        location,
        website,
        is_public,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING
        id,
        user_id AS "userId",
        display_name AS "displayName",
        bio,
        avatar_url AS "avatarUrl",
        avatar_s3_key AS "avatarS3Key",
        cover_image_url AS "coverImageUrl",
        cover_image_s3_key AS "coverImageS3Key",
        location,
        website,
        is_public AS "isPublic",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const values = [
      input.userId,
      input.displayName || null,
      input.bio || null,
      input.location || null,
      input.website || null,
      input.isPublic ?? true,
    ];

    const result: QueryResult = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing profile
   */
  async update(userId: number, input: UpdateProfileInput): Promise<UserProfile> {
    const fields: string[] = [];
    const values: (string | boolean | null)[] = [];
    let paramIndex = 1;

    if (input.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.bio !== undefined) {
      fields.push(`bio = $${paramIndex++}`);
      values.push(input.bio);
    }
    if (input.location !== undefined) {
      fields.push(`location = $${paramIndex++}`);
      values.push(input.location);
    }
    if (input.website !== undefined) {
      fields.push(`website = $${paramIndex++}`);
      values.push(input.website);
    }
    if (input.isPublic !== undefined) {
      fields.push(`is_public = $${paramIndex++}`);
      values.push(input.isPublic);
    }
    if (input.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(input.avatarUrl);
    }
    if (input.avatarS3Key !== undefined) {
      fields.push(`avatar_s3_key = $${paramIndex++}`);
      values.push(input.avatarS3Key);
    }
    if (input.coverImageUrl !== undefined) {
      fields.push(`cover_image_url = $${paramIndex++}`);
      values.push(input.coverImageUrl);
    }
    if (input.coverImageS3Key !== undefined) {
      fields.push(`cover_image_s3_key = $${paramIndex++}`);
      values.push(input.coverImageS3Key);
    }

    // Always update updated_at
    fields.push('updated_at = NOW()');

    values.push(userId as unknown as string); // Add userId as last parameter

    const query = `
      UPDATE user_profiles
      SET ${fields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING
        id,
        user_id AS "userId",
        display_name AS "displayName",
        bio,
        avatar_url AS "avatarUrl",
        avatar_s3_key AS "avatarS3Key",
        cover_image_url AS "coverImageUrl",
        cover_image_s3_key AS "coverImageS3Key",
        location,
        website,
        is_public AS "isPublic",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const result: QueryResult = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete a profile
   */
  async delete(userId: number): Promise<boolean> {
    const query = 'DELETE FROM user_profiles WHERE user_id = $1';
    const result: QueryResult = await this.pool.query(query, [userId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Search profiles by display name using ILIKE for case-insensitive matching
   */
  async searchByDisplayName(
    filters: ProfileSearchFilters
  ): Promise<{ profiles: UserProfile[]; total: number }> {
    const conditions: string[] = ['is_public = true'];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Search by query (display name, bio, location)
    if (filters.query) {
      conditions.push(`(
        display_name ILIKE $${paramIndex} OR
        bio ILIKE $${paramIndex} OR
        location ILIKE $${paramIndex}
      )`);
      values.push(`%${filters.query}%`);
      paramIndex++;
    }

    // Filter by location
    if (filters.location) {
      conditions.push(`location ILIKE $${paramIndex++}`);
      values.push(`%${filters.location}%`);
    }

    // Filter by isPublic
    if (filters.isPublic !== undefined) {
      conditions.push(`is_public = $${paramIndex++}`);
      values.push(filters.isPublic);
    }

    // Filter by hasAvatar
    if (filters.hasAvatar !== undefined) {
      if (filters.hasAvatar) {
        conditions.push('avatar_url IS NOT NULL');
      } else {
        conditions.push('avatar_url IS NULL');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderBy = 'created_at DESC';
    if (filters.sortBy === 'display_name') {
      orderBy = `display_name ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
    } else if (filters.sortBy === 'created_at') {
      orderBy = `created_at ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    }
    // For 'relevance', we keep the default order

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_profiles
      ${whereClause}
    `;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Main query with pagination
    const mainQuery = `
      SELECT
        id,
        user_id AS "userId",
        display_name AS "displayName",
        bio,
        avatar_url AS "avatarUrl",
        avatar_s3_key AS "avatarS3Key",
        cover_image_url AS "coverImageUrl",
        cover_image_s3_key AS "coverImageS3Key",
        location,
        website,
        is_public AS "isPublic",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_profiles
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(filters.limit, filters.offset);

    const result = await this.pool.query(mainQuery, values);

    return {
      profiles: result.rows,
      total,
    };
  }

  /**
   * Check if profile exists for user
   */
  async exists(userId: number): Promise<boolean> {
    const query = 'SELECT 1 FROM user_profiles WHERE user_id = $1 LIMIT 1';
    const result = await this.pool.query(query, [userId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
