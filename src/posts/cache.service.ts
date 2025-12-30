/**
 * Cache Service
 * 3-tier caching: Memory LRU -> Redis -> PostgreSQL
 * Implements cache-aside pattern with TTL support
 */

import Redis from 'ioredis';

// Simple LRU Cache implementation for L1 (in-memory)
class LRUCache<K, V> {
  private cache: Map<K, { value: V; expiry: number }>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: K, value: V, ttlSeconds: number): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Delete keys matching a pattern (simple implementation)
  deletePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (typeof key === 'string' && regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }
}

export interface CacheConfig {
  redisUrl?: string;
  memoryMaxSize?: number;
  defaultTtl?: number;
}

export class CacheService {
  private memoryCache: LRUCache<string, string>;
  private redis: Redis | null = null;
  private defaultTtl: number;

  constructor(config: CacheConfig = {}) {
    this.memoryCache = new LRUCache(config.memoryMaxSize || 1000);
    this.defaultTtl = config.defaultTtl || 300; // 5 minutes default

    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl);
    }
  }

  /**
   * Get value from cache (L1 Memory -> L2 Redis)
   */
  async get(key: string): Promise<string | null> {
    // L1: Check memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== null) {
      return memoryValue;
    }

    // L2: Check Redis
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(key);
        if (redisValue !== null) {
          // Warm L1 cache
          this.memoryCache.set(key, redisValue, 60); // 1 min L1 TTL
          return redisValue;
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    return null;
  }

  /**
   * Set value in cache (both L1 and L2)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTtl;

    // L1: Memory cache (shorter TTL)
    this.memoryCache.set(key, value, Math.min(ttl, 60));

    // L2: Redis
    if (this.redis) {
      try {
        await this.redis.setex(key, ttl, value);
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    // L1: Memory cache
    this.memoryCache.delete(key);

    // L2: Redis
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }

  /**
   * Delete all keys matching a pattern
   * Uses SCAN for Redis (production-safe, no blocking)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // L1: Memory cache
    deletedCount += this.memoryCache.deletePattern(pattern);

    // L2: Redis (use SCAN for safety)
    if (this.redis) {
      try {
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );
          cursor = newCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== '0');
      } catch (error) {
        console.error('Redis invalidatePattern error:', error);
      }
    }

    return deletedCount;
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    if (this.redis) {
      try {
        return await this.redis.incr(key);
      } catch (error) {
        console.error('Redis incr error:', error);
      }
    }
    return 0;
  }

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    if (this.redis) {
      try {
        return await this.redis.decr(key);
      } catch (error) {
        console.error('Redis decr error:', error);
      }
    }
    return 0;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    // Check L1 first
    if (this.memoryCache.get(key) !== null) {
      return true;
    }

    // Check L2
    if (this.redis) {
      try {
        return (await this.redis.exists(key)) === 1;
      } catch (error) {
        console.error('Redis exists error:', error);
      }
    }

    return false;
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.redis) {
      try {
        return (await this.redis.expire(key, ttlSeconds)) === 1;
      } catch (error) {
        console.error('Redis expire error:', error);
      }
    }
    return false;
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (this.redis && keys.length > 0) {
      try {
        return await this.redis.mget(...keys);
      } catch (error) {
        console.error('Redis mget error:', error);
      }
    }
    return keys.map(() => null);
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Clear all caches (use with caution!)
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }
  }
}

// Cache key builders
export class CacheKeyBuilder {
  static homeFeed(userId: string, page: number = 1): string {
    return `feed:home:user:${userId}:page:${page}:v1`;
  }

  static groupFeed(groupId: string, page: number = 1): string {
    return `feed:group:${groupId}:page:${page}:v1`;
  }

  static userProfileFeed(userId: string, page: number = 1): string {
    return `feed:profile:user:${userId}:page:${page}:v1`;
  }

  static post(postId: string): string {
    return `post:${postId}:v1`;
  }

  static postReactions(postId: string): string {
    return `post:${postId}:reactions`;
  }

  static userProfile(userId: string): string {
    return `user:${userId}:profile:v1`;
  }

  static homeFeedPattern(userId: string): string {
    return `feed:home:user:${userId}:*`;
  }

  static groupFeedPattern(groupId: string): string {
    return `feed:group:${groupId}:*`;
  }

  static userProfileFeedPattern(userId: string): string {
    return `feed:profile:user:${userId}:*`;
  }
}

// Export singleton for default use
export const cacheService = new CacheService({
  redisUrl: process.env.REDIS_URL,
});
