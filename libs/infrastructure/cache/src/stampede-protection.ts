import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Cache stampede prevention using the XFetch algorithm (probabilistic early expiration)
 * and Redis-based distributed locking per ADR-010.
 *
 * When a cached value is approaching expiration, this utility probabilistically
 * decides whether to trigger a background refresh, returning the stale value
 * immediately. A distributed lock (SETNX) prevents multiple instances from
 * refreshing concurrently (thundering herd).
 */
export class StampedeProtection {
  private readonly logger = new Logger(StampedeProtection.name);

  /** Lock key prefix in Redis */
  private static readonly LOCK_PREFIX = 'lock:refresh:';

  /** Maximum lock TTL in seconds to prevent deadlocks */
  private static readonly LOCK_TTL_SECONDS = 10;

  constructor(private readonly redis: Redis) {}

  /**
   * XFetch algorithm: returns true if the cache entry should be refreshed early.
   *
   * The probability of returning true increases as the remaining TTL approaches 0.
   * This spreads refresh load across time rather than concentrating it at expiry.
   *
   * @param remainingTtlSeconds - Seconds remaining before the cache entry expires
   * @param estimatedComputeSeconds - Estimated time to recompute the value (e.g., DB query time)
   * @param beta - Tuning parameter; higher values trigger earlier refresh (default: 1.0)
   * @returns true if the caller should refresh the cache entry
   */
  static shouldRefreshEarly(
    remainingTtlSeconds: number,
    estimatedComputeSeconds: number,
    beta: number = 1.0,
  ): boolean {
    if (remainingTtlSeconds <= 0) {
      return true;
    }

    const random = Math.random();
    // XFetch formula: -delta * beta * ln(random) >= ttl
    const threshold = estimatedComputeSeconds * beta * Math.log(random);
    return -threshold >= remainingTtlSeconds;
  }

  /**
   * Attempt to acquire a distributed refresh lock for the given cache key.
   *
   * Uses Redis SETNX with a TTL to prevent deadlocks. Only one process/instance
   * will successfully acquire the lock; all others will get false and should
   * return the stale cached value.
   *
   * @param key - The cache key being refreshed
   * @returns true if the lock was acquired (caller should perform the refresh)
   */
  async acquireRefreshLock(key: string): Promise<boolean> {
    const lockKey = StampedeProtection.LOCK_PREFIX + key;
    try {
      const result = await this.redis.set(
        lockKey,
        '1',
        'EX',
        StampedeProtection.LOCK_TTL_SECONDS,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        `Failed to acquire refresh lock for "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Release the distributed refresh lock for the given cache key.
   *
   * @param key - The cache key whose lock should be released
   */
  async releaseRefreshLock(key: string): Promise<void> {
    const lockKey = StampedeProtection.LOCK_PREFIX + key;
    try {
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.error(
        `Failed to release refresh lock for "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * High-level helper: get a cached value with stampede protection.
   *
   * If the value exists and its TTL is still healthy, returns it directly.
   * If the TTL is low and XFetch decides to refresh early, the provided
   * `recompute` callback is invoked in the background (behind a distributed lock),
   * while the stale value is returned immediately.
   *
   * @param key - Cache key
   * @param getCached - Function to retrieve the current cached value
   * @param recompute - Function that recomputes and stores the value in cache
   * @param options - Configuration for the XFetch algorithm
   * @returns The cached value, or null if not cached
   */
  async getWithProtection<T>(
    key: string,
    getCached: () => Promise<{ value: T; ttlSeconds: number } | null>,
    recompute: () => Promise<void>,
    options?: {
      estimatedComputeSeconds?: number;
      beta?: number;
    },
  ): Promise<T | null> {
    const cached = await getCached();
    if (!cached) {
      return null;
    }

    const estimatedCompute = options?.estimatedComputeSeconds ?? 0.05;
    const beta = options?.beta ?? 1.0;

    if (
      StampedeProtection.shouldRefreshEarly(
        cached.ttlSeconds,
        estimatedCompute,
        beta,
      )
    ) {
      // Attempt background refresh behind a lock
      const acquired = await this.acquireRefreshLock(key);
      if (acquired) {
        // Fire-and-forget: refresh in background, release lock when done
        recompute()
          .catch((error) => {
            this.logger.error(
              `Background refresh failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
            );
          })
          .finally(() => {
            this.releaseRefreshLock(key).catch(() => {
              // Lock will auto-expire via TTL
            });
          });
      }
    }

    // Return the (possibly stale) cached value immediately
    return cached.value;
  }
}
