import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/** Default TTL for processed event records: 24 hours. */
const DEFAULT_TTL_SECONDS = 86400;

/** Redis key prefix for idempotency records. */
const KEY_PREFIX = 'idempotent:';

/**
 * Redis-backed idempotency store for integration event handlers.
 *
 * Prevents duplicate processing of at-least-once delivered events
 * by tracking processed event IDs with a configurable TTL.
 */
@Injectable()
export class IdempotencyStore implements OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyStore.name);
  private readonly redis: Redis;

  constructor(redisOptions: RedisOptions) {
    this.redis = new Redis(redisOptions);
  }

  /**
   * Check whether an event has already been processed.
   *
   * @param eventId - The unique event identifier.
   * @returns true if the event was already processed.
   */
  async isProcessed(eventId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getKey(eventId));
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check idempotency for event "${eventId}": ${error}`,
      );
      // On Redis failure, allow processing to proceed (fail-open).
      // The handler itself should be safe to re-execute.
      return false;
    }
  }

  /**
   * Mark an event as processed with a TTL.
   *
   * @param eventId - The unique event identifier.
   * @param ttlSeconds - Time-to-live in seconds (default: 24 hours).
   */
  async markProcessed(
    eventId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.getKey(eventId),
        '1',
        'EX',
        ttlSeconds,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark event "${eventId}" as processed: ${error}`,
      );
      // Non-fatal: worst case the event gets processed again.
    }
  }

  /**
   * Ensure idempotent execution of a handler for the given event ID.
   *
   * Performs the check-then-execute-then-mark pattern:
   * 1. Check if already processed
   * 2. Execute the handler
   * 3. Mark as processed
   *
   * @param eventId - The unique event identifier.
   * @param handler - The handler function to execute.
   * @returns true if the handler was actually executed, false if skipped (already processed).
   */
  async ensureIdempotent(
    eventId: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const alreadyProcessed = await this.isProcessed(eventId);
    if (alreadyProcessed) {
      this.logger.debug(
        `Skipping duplicate event "${eventId}" (already processed)`,
      );
      return false;
    }

    try {
      await handler();
      await this.markProcessed(eventId);
      return true;
    } catch (error) {
      this.logger.error(
        `Handler failed for event "${eventId}": ${error}`,
      );
      // Do NOT mark as processed so the event can be retried.
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(eventId: string): string {
    return `${KEY_PREFIX}${eventId}`;
  }
}
