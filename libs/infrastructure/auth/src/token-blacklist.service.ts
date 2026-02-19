import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Injection token for the Redis client instance.
 * This should match the token used in the cache infrastructure module.
 * If the cache module uses a different token, update this constant
 * or provide an alias in the module configuration.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/** Redis key prefix for blacklisted token JTIs. */
const BLACKLIST_PREFIX = 'token:blacklist:';

/** Redis key prefix for per-user token tracking. */
const USER_TOKEN_PREFIX = 'token:user:';

/** Number of keys to scan per Redis SCAN iteration. */
const SCAN_COUNT = 100;

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Add a token's jti to the blacklist.
   * The TTL should match the remaining lifetime of the token so the
   * entry is automatically cleaned up after the token would have expired.
   */
  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    const key = `${BLACKLIST_PREFIX}${jti}`;
    await this.redis.set(key, '1', 'EX', ttlSeconds);
    this.logger.debug(`Blacklisted token jti=${jti} with TTL=${ttlSeconds}s`);
  }

  /**
   * Check whether a token jti has been blacklisted.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const key = `${BLACKLIST_PREFIX}${jti}`;
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Blacklist all tracked tokens for a given user.
   * Uses Redis SCAN (never KEYS) to iterate safely without blocking the server.
   * This supports the "logout from all devices" functionality.
   */
  async blacklistAllForUser(userId: string): Promise<void> {
    const pattern = `${USER_TOKEN_PREFIX}${userId}:*`;
    let cursor = '0';
    let totalBlacklisted = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_COUNT,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();

        for (const key of keys) {
          // Extract the jti from the key: 'token:user:{userId}:{jti}'
          const jti = key.substring(key.lastIndexOf(':') + 1);

          // Get the TTL of the user-token tracking key to use for the blacklist entry
          const ttl = await this.redis.ttl(key);
          if (ttl > 0) {
            pipeline.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
          }

          // Remove the user-token tracking key
          pipeline.del(key);
        }

        await pipeline.exec();
        totalBlacklisted += keys.length;
      }
    } while (cursor !== '0');

    this.logger.log(
      `Blacklisted ${totalBlacklisted} tokens for user=${userId}`,
    );
  }

  /**
   * Track a token so it can be found during per-user revocation.
   * Stores a reference key: 'token:user:{userId}:{jti}' with a TTL
   * matching the token lifetime.
   */
  async trackToken(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    const key = `${USER_TOKEN_PREFIX}${userId}:${jti}`;
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }
}
