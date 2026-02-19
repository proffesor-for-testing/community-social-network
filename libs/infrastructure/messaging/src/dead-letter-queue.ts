import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Entry stored in the dead letter queue for debugging and replay.
 */
export interface DLQEntry {
  /** Original job ID. */
  id: string;
  /** Name of the original queue the job failed in. */
  queue: string;
  /** Full job data payload. */
  data: Record<string, unknown>;
  /** Error message from the last failure. */
  error: string;
  /** ISO 8601 timestamp of when the job was moved to the DLQ. */
  timestamp: string;
  /** Number of attempts made before the job was moved. */
  attempts: number;
}

/**
 * Dead Letter Queue service for failed Bull queue jobs.
 *
 * Uses Redis lists keyed by `dlq:{originalQueue}` to store failed job metadata.
 * Supports inspection, retry (move back to original queue), and purge operations.
 */
@Injectable()
export class DeadLetterQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly redis: Redis;

  constructor(redisOptions: RedisOptions) {
    this.redis = new Redis(redisOptions);
  }

  /**
   * Move a failed job to the dead letter queue.
   *
   * @param originalQueue - The queue the job originally belonged to.
   * @param jobId - The job's unique identifier.
   * @param jobData - The full job data payload.
   * @param error - The error that caused the final failure.
   * @param attemptsMade - Number of processing attempts before failure.
   */
  async moveToDeadLetter(
    originalQueue: string,
    jobId: string,
    jobData: Record<string, unknown>,
    error: Error,
    attemptsMade: number,
  ): Promise<void> {
    const entry: DLQEntry = {
      id: jobId,
      queue: originalQueue,
      data: jobData,
      error: error.message,
      timestamp: new Date().toISOString(),
      attempts: attemptsMade,
    };

    const key = this.getDlqKey(originalQueue);
    await this.redis.lpush(key, JSON.stringify(entry));

    this.logger.warn(
      `Moved job "${jobId}" from queue "${originalQueue}" to DLQ: ${error.message}`,
    );
  }

  /**
   * Retrieve dead letter entries for a given queue.
   *
   * @param queue - The original queue name.
   * @param limit - Maximum number of entries to return (default 50).
   */
  async getDeadLetterJobs(
    queue: string,
    limit: number = 50,
  ): Promise<DLQEntry[]> {
    const key = this.getDlqKey(queue);
    const raw = await this.redis.lrange(key, 0, limit - 1);
    return raw.map((entry) => JSON.parse(entry) as DLQEntry);
  }

  /**
   * Retry a dead letter job by moving it back to the original queue.
   * The entry is removed from the DLQ after successful re-queue.
   *
   * This uses a BullMQ Queue internally to re-add the job.
   *
   * @param queue - The original queue name.
   * @param jobId - The job ID to retry.
   * @throws Error if the job is not found in the DLQ.
   */
  async retryDeadLetterJob(queue: string, jobId: string): Promise<void> {
    const key = this.getDlqKey(queue);
    const entries = await this.redis.lrange(key, 0, -1);

    let targetEntry: DLQEntry | null = null;
    let targetIndex = -1;

    for (let i = 0; i < entries.length; i++) {
      const entry = JSON.parse(entries[i]) as DLQEntry;
      if (entry.id === jobId) {
        targetEntry = entry;
        targetIndex = i;
        break;
      }
    }

    if (!targetEntry) {
      throw new Error(
        `Job "${jobId}" not found in DLQ for queue "${queue}"`,
      );
    }

    // Re-publish the job data to a well-known retry list that consumers can pick up.
    // The actual re-queue into BullMQ is handled by the messaging module's consumer setup.
    const retryKey = `retry:${queue}`;
    await this.redis.lpush(retryKey, JSON.stringify(targetEntry.data));

    // Remove the entry from the DLQ.
    // Use LREM to remove the exact serialized value at the found position.
    await this.redis.lrem(key, 1, entries[targetIndex]);

    this.logger.log(
      `Retried DLQ job "${jobId}" - moved back to retry list for queue "${queue}"`,
    );
  }

  /**
   * Purge all dead letter entries for a given queue.
   *
   * @param queue - The original queue name.
   */
  async purgeDeadLetterQueue(queue: string): Promise<void> {
    const key = this.getDlqKey(queue);
    const count = await this.redis.llen(key);
    await this.redis.del(key);

    this.logger.warn(
      `Purged ${count} entries from DLQ for queue "${queue}"`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private getDlqKey(queue: string): string {
    return `dlq:${queue}`;
  }
}
