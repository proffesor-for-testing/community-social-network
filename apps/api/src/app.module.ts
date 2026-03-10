import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule, JwtAuthGuard } from '@csn/infra-auth';
import { RedisModule } from '@csn/infra-cache';
import { DatabaseModule } from '@csn/infra-database';
import { MessagingModule } from '@csn/infra-messaging';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),

    // Infrastructure
    DatabaseModule,
    RedisModule,
    AuthModule,
    MessagingModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth guard (opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global rate limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
