import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ICacheService } from './cache.interface';

interface MemoryCacheEntry {
  data: unknown;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * 3-tier cache implementation per ADR-010.
 *
 * Layer 1: In-memory Map with TTL (default 30s, max 1000 entries, LRU eviction)
 * Layer 2: Redis with configurable TTL (default 5 minutes)
 * Layer 3: null -- caller is responsible for database fallback
 */
export class ThreeTierCacheService implements ICacheService {
  private readonly logger = new Logger(ThreeTierCacheService.name);
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();
  private readonly maxMemoryEntries: number;
  private readonly defaultTtlSeconds: number;
  private readonly memoryTtlMs: number;
  private readonly pruneInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly redis: Redis,
    options?: {
      maxMemoryEntries?: number;
      defaultTtlSeconds?: number;
      memoryTtlMs?: number;
    },
  ) {
    this.maxMemoryEntries = options?.maxMemoryEntries ?? 1000;
    this.defaultTtlSeconds = options?.defaultTtlSeconds ?? 300;
    this.memoryTtlMs = options?.memoryTtlMs ?? 30000;

    // Prune expired memory entries every 60 seconds
    this.pruneInterval = setInterval(() => this.pruneExpired(), 60000);
    // Allow the process to exit even if the interval is still running
    if (this.pruneInterval.unref) {
      this.pruneInterval.unref();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Tier 1: check in-memory cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      memEntry.lastAccessed = Date.now();
      return memEntry.data as T;
    }

    // Remove stale memory entry if present
    if (memEntry) {
      this.memoryCache.delete(key);
    }

    // Tier 2: check Redis
    try {
      const redisData = await this.redis.get(key);
      if (redisData !== null) {
        const parsed = JSON.parse(redisData) as T;

        // Promote to memory cache
        this.setMemory(key, parsed);

        return parsed;
      }
    } catch (error) {
      this.logger.error(
        `Redis GET error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Tier 3: cache miss -- caller hits database
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;

    // Write to Redis
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logger.error(
        `Redis SET error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Write to memory cache
    this.setMemory(key, value);
  }

  async delete(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key);

    // Remove from Redis
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(
        `Redis DEL error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    // Check memory first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return true;
    }

    // Check Redis
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Redis EXISTS error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const redisMissKeys: string[] = [];

    // Check memory first
    for (const key of keys) {
      const memEntry = this.memoryCache.get(key);
      if (memEntry && memEntry.expiresAt > Date.now()) {
        memEntry.lastAccessed = Date.now();
        results.set(key, memEntry.data as T);
      } else {
        if (memEntry) {
          this.memoryCache.delete(key);
        }
        redisMissKeys.push(key);
      }
    }

    // Batch fetch from Redis for memory misses
    if (redisMissKeys.length > 0) {
      try {
        const redisValues = await this.redis.mget(...redisMissKeys);
        for (let i = 0; i < redisMissKeys.length; i++) {
          const key = redisMissKeys[i];
          const raw = redisValues[i];
          if (raw !== null) {
            const parsed = JSON.parse(raw) as T;
            this.setMemory(key, parsed);
            results.set(key, parsed);
          } else {
            results.set(key, null);
          }
        }
      } catch (error) {
        this.logger.error(
          `Redis MGET error: ${error instanceof Error ? error.message : String(error)}`,
        );
        for (const key of redisMissKeys) {
          if (!results.has(key)) {
            results.set(key, null);
          }
        }
      }
    }

    return results;
  }

  async setMany<T>(entries: Map<string, T>, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;

    // Write to Redis via pipeline for efficiency
    try {
      const pipeline = this.redis.pipeline();
      for (const [key, value] of entries) {
        pipeline.set(key, JSON.stringify(value), 'EX', ttl);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.error(
        `Redis pipeline SET error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Write to memory
    for (const [key, value] of entries) {
      this.setMemory(key, value);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    // Use SCAN to avoid blocking Redis (per ADR-005 fix)
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(
        `Redis SCAN/DEL error for pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Delete matching keys from memory
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(
        `Redis TTL error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return -2;
    }
  }

  /**
   * Stop the background prune interval. Call this on module destroy.
   */
  destroy(): void {
    clearInterval(this.pruneInterval);
  }

  // --- Private helpers ---

  private setMemory(key: string, data: unknown): void {
    // Evict LRU entry if at capacity
    if (
      this.memoryCache.size >= this.maxMemoryEntries &&
      !this.memoryCache.has(key)
    ) {
      this.evictLru();
    }

    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + this.memoryTtlMs,
      lastAccessed: Date.now(),
    });
  }

  private evictLru(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }
}
