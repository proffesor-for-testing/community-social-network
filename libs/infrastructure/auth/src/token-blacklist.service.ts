import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@csn/infra-cache';

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
        // Batch fetch TTLs via pipeline to avoid N+1
        const ttlPipeline = this.redis.pipeline();
        for (const key of keys) {
          ttlPipeline.ttl(key);
        }
        const ttlResults = await ttlPipeline.exec();

        const blacklistPipeline = this.redis.pipeline();
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const jti = key.substring(key.lastIndexOf(':') + 1);
          const ttl = ttlResults?.[i]?.[1] as number ?? 0;
          if (ttl > 0) {
            blacklistPipeline.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
          }
          blacklistPipeline.del(key);
        }
        await blacklistPipeline.exec();
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
