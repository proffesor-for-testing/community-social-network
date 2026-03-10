import { BullModule } from '@nestjs/bull';
import type { RedisOptions } from 'ioredis';

/**
 * Default Redis connection options derived from environment variables.
 */
export function getRedisOptions(): RedisOptions {
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Default job options shared across all Bull queues.
 */
export const DEFAULT_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

/**
 * BullModule async configuration for use in NestJS module imports.
 *
 * Usage:
 * ```
 * @Module({ imports: [BullRootModuleConfig] })
 * ```
 */
export const BullRootModuleConfig = BullModule.forRootAsync({
  useFactory: () => ({
    redis: getRedisOptions(),
    ...DEFAULT_QUEUE_OPTIONS,
  }),
});
