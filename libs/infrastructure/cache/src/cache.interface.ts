/**
 * Cache service interface for the 3-tier caching strategy.
 *
 * Tier 1: In-memory (fastest, 30s TTL)
 * Tier 2: Redis (fast, configurable TTL)
 * Tier 3: null (caller falls through to database)
 */
export interface ICacheService {
  /**
   * Retrieve a value from the cache.
   * Checks memory first, then Redis. Returns null on miss.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in both memory and Redis caches.
   * @param key - Cache key
   * @param value - Value to store (must be JSON-serializable)
   * @param ttlSeconds - Time-to-live in seconds (default: 300)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Remove a value from both memory and Redis caches.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in either cache layer.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Retrieve multiple values from the cache.
   * Returns a map of key to value; missing keys map to null.
   */
  getMany<T>(keys: string[]): Promise<Map<string, T | null>>;

  /**
   * Store multiple key-value pairs in both caches.
   * @param entries - Map of key to value
   * @param ttlSeconds - Time-to-live in seconds (default: 300)
   */
  setMany<T>(entries: Map<string, T>, ttlSeconds?: number): Promise<void>;

  /**
   * Delete all keys matching a glob pattern (e.g., "user:*").
   * Uses Redis SCAN to avoid blocking.
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Get the remaining TTL for a key in Redis (seconds).
   * Returns -2 if the key does not exist, -1 if no TTL is set.
   */
  getTtl(key: string): Promise<number>;
}
