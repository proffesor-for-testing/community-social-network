/**
 * Rate Limiter
 * Implements sliding window rate limiting using Redis sorted sets
 */

import {
  RateLimitResult,
  AccountLockoutResult,
  FailedAttemptResult,
  AuthConfig,
  defaultAuthConfig,
} from './auth.types';

// Redis client interface (for dependency injection)
export interface RedisClient {
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
}

export interface RateLimiter {
  checkLimit(type: string, identifier: string): Promise<RateLimitResult>;
  checkAccountLockout(userId: number): Promise<AccountLockoutResult>;
  setAccountLockout(userId: number, duration: number): Promise<void>;
  incrementFailedAttempt(userId: number): Promise<FailedAttemptResult>;
  resetFailedAttempts(userId: number): Promise<void>;
}

export class RedisRateLimiter implements RateLimiter {
  private readonly redis: RedisClient;
  private readonly config: AuthConfig;

  constructor(redis: RedisClient, config: Partial<AuthConfig> = {}) {
    this.redis = redis;
    this.config = { ...defaultAuthConfig, ...config };
  }

  /**
   * Check if a request is within rate limits using sliding window algorithm
   * Time complexity: O(log n) for Redis sorted set operations
   *
   * @param type - Type of rate limit (registration, login, password_reset)
   * @param identifier - Unique identifier (IP address or user ID)
   * @returns RateLimitResult with allowed status and remaining count
   */
  async checkLimit(type: string, identifier: string): Promise<RateLimitResult> {
    const limitConfig = this.getRateLimitConfig(type);
    const key = `ratelimit:${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - limitConfig.window * 1000;

    // Remove entries older than the window
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const count = await this.redis.zcard(key);

    if (count >= limitConfig.limit) {
      // Calculate retry time
      const retryAfter = Math.ceil(limitConfig.window);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Add current request to the sorted set
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, limitConfig.window * 2);

    return {
      allowed: true,
      remaining: limitConfig.limit - count - 1,
    };
  }

  /**
   * Check if an account is locked out
   * Time complexity: O(1)
   *
   * @param userId - User ID to check
   * @returns AccountLockoutResult with lock status
   */
  async checkAccountLockout(userId: number): Promise<AccountLockoutResult> {
    const key = `lockout:account:${userId}`;
    const lockoutData = await this.redis.get(key);

    if (!lockoutData) {
      return { locked: false };
    }

    try {
      const data = JSON.parse(lockoutData);
      const lockedUntil = new Date(data.lockedUntil);

      if (lockedUntil > new Date()) {
        return {
          locked: true,
          lockedUntil,
        };
      }

      // Lockout has expired, clean up
      await this.redis.del(key);
      return { locked: false };
    } catch {
      return { locked: false };
    }
  }

  /**
   * Set an account lockout
   * Time complexity: O(1)
   *
   * @param userId - User ID to lock
   * @param duration - Lockout duration in seconds
   */
  async setAccountLockout(userId: number, duration: number): Promise<void> {
    const key = `lockout:account:${userId}`;
    const lockedUntil = Date.now() + duration * 1000;

    await this.redis.setex(
      key,
      duration,
      JSON.stringify({
        lockedUntil,
        reason: 'brute_force',
        createdAt: Date.now(),
      })
    );
  }

  /**
   * Increment failed login attempt counter
   * Time complexity: O(1)
   *
   * @param userId - User ID
   * @returns FailedAttemptResult with current count and lock status
   */
  async incrementFailedAttempt(userId: number): Promise<FailedAttemptResult> {
    const key = `failed:attempts:${userId}`;

    // Increment counter
    const attempts = await this.redis.incr(key);

    // Set expiry for the counter (same as lockout duration)
    await this.redis.expire(key, this.config.lockoutDuration);

    const shouldLock = attempts >= this.config.maxFailedAttempts;

    return {
      attempts,
      shouldLock,
    };
  }

  /**
   * Reset failed login attempts for a user
   * Time complexity: O(1)
   *
   * @param userId - User ID
   */
  async resetFailedAttempts(userId: number): Promise<void> {
    const key = `failed:attempts:${userId}`;
    await this.redis.del(key);
  }

  private getRateLimitConfig(type: string): { limit: number; window: number } {
    const limits = this.config.rateLimits;

    switch (type) {
      case 'registration':
        return limits.registration;
      case 'login':
        return limits.login;
      case 'password_reset':
        return limits.passwordReset;
      default:
        return { limit: 100, window: 3600 }; // Default fallback
    }
  }
}

/**
 * In-memory rate limiter for testing
 */
export class InMemoryRateLimiter implements RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private lockouts: Map<number, Date> = new Map();
  private failedAttempts: Map<number, number> = new Map();
  private readonly config: AuthConfig;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = { ...defaultAuthConfig, ...config };
  }

  async checkLimit(type: string, identifier: string): Promise<RateLimitResult> {
    const limitConfig = this.getRateLimitConfig(type);
    const key = `${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - limitConfig.window * 1000;

    // Get or create request array
    let requests = this.requests.get(key) || [];

    // Remove old requests
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= limitConfig.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: limitConfig.window,
      };
    }

    // Add current request
    requests.push(now);
    this.requests.set(key, requests);

    return {
      allowed: true,
      remaining: limitConfig.limit - requests.length,
    };
  }

  async checkAccountLockout(userId: number): Promise<AccountLockoutResult> {
    const lockedUntil = this.lockouts.get(userId);

    if (!lockedUntil) {
      return { locked: false };
    }

    if (lockedUntil > new Date()) {
      return { locked: true, lockedUntil };
    }

    // Lockout expired
    this.lockouts.delete(userId);
    return { locked: false };
  }

  async setAccountLockout(userId: number, duration: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + duration * 1000);
    this.lockouts.set(userId, lockedUntil);
  }

  async incrementFailedAttempt(userId: number): Promise<FailedAttemptResult> {
    const current = this.failedAttempts.get(userId) || 0;
    const attempts = current + 1;
    this.failedAttempts.set(userId, attempts);

    return {
      attempts,
      shouldLock: attempts >= this.config.maxFailedAttempts,
    };
  }

  async resetFailedAttempts(userId: number): Promise<void> {
    this.failedAttempts.delete(userId);
  }

  private getRateLimitConfig(type: string): { limit: number; window: number } {
    const limits = this.config.rateLimits;

    switch (type) {
      case 'registration':
        return limits.registration;
      case 'login':
        return limits.login;
      case 'password_reset':
        return limits.passwordReset;
      default:
        return { limit: 100, window: 3600 };
    }
  }

  // Helper methods for testing
  clear(): void {
    this.requests.clear();
    this.lockouts.clear();
    this.failedAttempts.clear();
  }
}

/**
 * Factory function to create a rate limiter
 */
export function createRateLimiter(
  redis?: RedisClient,
  config?: Partial<AuthConfig>
): RateLimiter {
  if (redis) {
    return new RedisRateLimiter(redis, config);
  }
  return new InMemoryRateLimiter(config);
}
