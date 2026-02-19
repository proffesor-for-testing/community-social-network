import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export const REDIS_CONFIG_KEY = 'redis';

export interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}

export const redisConfig = registerAs(
  REDIS_CONFIG_KEY,
  (): RedisConfig => ({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: parseInt(process.env['REDIS_DB'] || '0', 10),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times: number): number | null => {
      if (times > 10) {
        return null; // Stop retrying after 10 attempts
      }
      return Math.min(times * 200, 5000);
    },
  }),
);
