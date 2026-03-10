import {
  Global,
  Module,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConfig, REDIS_CONFIG_KEY, RedisConfig } from './redis.config';
import { ThreeTierCacheService } from './three-tier-cache.service';
import { ICacheService } from './cache.interface';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const CACHE_SERVICE = Symbol('CACHE_SERVICE');

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const config = configService.get<RedisConfig>(REDIS_CONFIG_KEY);
        if (!config) {
          throw new Error(
            'Redis configuration not found. Ensure redisConfig is registered.',
          );
        }

        const logger = new Logger('RedisModule');
        const client = new Redis(config);

        client.on('connect', () => {
          logger.log('Redis client connected');
        });

        client.on('error', (err: Error) => {
          logger.error(`Redis client error: ${err.message}`, err.stack);
        });

        client.on('close', () => {
          logger.warn('Redis client connection closed');
        });

        return client;
      },
    },
    {
      provide: CACHE_SERVICE,
      inject: [REDIS_CLIENT],
      useFactory: (redisClient: Redis): ICacheService => {
        return new ThreeTierCacheService(redisClient);
      },
    },
  ],
  exports: [REDIS_CLIENT, CACHE_SERVICE],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    try {
      // Destroy cache service (clears prune interval)
      if ('destroy' in this.cacheService && typeof (this.cacheService as { destroy: unknown }).destroy === 'function') {
        (this.cacheService as { destroy(): void }).destroy();
      }
      await this.redis.quit();
      this.logger.log('Redis client disconnected gracefully');
    } catch (error) {
      this.logger.error(
        'Error disconnecting Redis client',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
