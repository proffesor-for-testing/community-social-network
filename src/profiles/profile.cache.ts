/**
 * Profile Cache - Redis caching layer for User Profiles
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Provides caching functionality for profile data to reduce database load
 */

import Redis from 'ioredis';
import { UserProfile, CacheConfig } from './profile.types';

const DEFAULT_TTL = 300; // 5 minutes in seconds

export class ProfileCache {
  private redis: Redis;
  private keyPrefix: string;
  private ttl: number;

  constructor(redis?: Redis, config?: Partial<CacheConfig>) {
    this.redis = redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.keyPrefix = 'profile:';
    this.ttl = config?.profileTtl || DEFAULT_TTL;
  }

  /**
   * Generate cache key for a user profile
   */
  private getKey(userId: number): string {
    return `${this.keyPrefix}${userId}`;
  }

  /**
   * Get profile from cache
   */
  async get(userId: number): Promise<UserProfile | null> {
    try {
      const cached = await this.redis.get(this.getKey(userId));
      if (cached) {
        const profile = JSON.parse(cached);
        // Convert date strings back to Date objects
        return {
          ...profile,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt),
        };
      }
      return null;
    } catch (error) {
      // Log error but don't throw - cache failures should be graceful
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set profile in cache
   */
  async set(userId: number, profile: UserProfile, ttl?: number): Promise<void> {
    try {
      const key = this.getKey(userId);
      const value = JSON.stringify(profile);
      await this.redis.setex(key, ttl || this.ttl, value);
    } catch (error) {
      // Log error but don't throw - cache failures should be graceful
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate profile cache
   */
  async invalidate(userId: number): Promise<void> {
    try {
      await this.redis.del(this.getKey(userId));
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Invalidate multiple profiles by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Check if profile exists in cache
   */
  async exists(userId: number): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getKey(userId));
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL for cached profile
   */
  async getTtl(userId: number): Promise<number> {
    try {
      return await this.redis.ttl(this.getKey(userId));
    } catch (error) {
      console.error('Cache getTtl error:', error);
      return -1;
    }
  }

  /**
   * Refresh TTL for cached profile
   */
  async refreshTtl(userId: number, ttl?: number): Promise<void> {
    try {
      await this.redis.expire(this.getKey(userId), ttl || this.ttl);
    } catch (error) {
      console.error('Cache refreshTtl error:', error);
    }
  }

  /**
   * Get multiple profiles from cache
   */
  async getMany(userIds: number[]): Promise<Map<number, UserProfile>> {
    const result = new Map<number, UserProfile>();

    try {
      if (userIds.length === 0) return result;

      const keys = userIds.map(id => this.getKey(id));
      const values = await this.redis.mget(...keys);

      values.forEach((value, index) => {
        if (value && userIds[index] !== undefined) {
          const profile = JSON.parse(value);
          result.set(userIds[index], {
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
          });
        }
      });
    } catch (error) {
      console.error('Cache getMany error:', error);
    }

    return result;
  }

  /**
   * Set multiple profiles in cache
   */
  async setMany(profiles: UserProfile[]): Promise<void> {
    try {
      if (profiles.length === 0) return;

      const pipeline = this.redis.pipeline();
      profiles.forEach(profile => {
        const key = this.getKey(profile.userId);
        const value = JSON.stringify(profile);
        pipeline.setex(key, this.ttl, value);
      });
      await pipeline.exec();
    } catch (error) {
      console.error('Cache setMany error:', error);
    }
  }

  /**
   * Clear all profile cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
