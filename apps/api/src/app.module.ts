import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule, JwtAuthGuard } from '@csn/infra-auth';
import { RedisModule } from '@csn/infra-cache';
import { DatabaseModule } from '@csn/infra-database';
import { MessagingModule } from '@csn/infra-messaging';
import { ObservabilityModule } from '@csn/infra-observability';
import { HealthController } from './health.controller';

// Infrastructure modules (TypeORM entity registration + repository providers)
import { IdentityInfrastructureModule } from '@csn/infra-identity';
import { ProfileInfrastructureModule } from '@csn/infra-profile';
import { ContentInfrastructureModule } from '@csn/infra-content';
import { SocialGraphInfrastructureModule } from '@csn/infra-social-graph';
import { CommunityInfrastructureModule } from '@csn/infra-community';
import { NotificationInfrastructureModule } from '@csn/infra-notification';
import { AdminInfrastructureModule } from '@csn/infra-admin';

// Application-layer context modules
import { IdentityModule } from './modules/identity/identity.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ContentModule } from './modules/content/content.module';
import { SocialGraphModule } from './modules/social-graph/social-graph.module';
import { CommunityModule } from './modules/community/community.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { UploadModule } from './modules/upload/upload.module';

// Cross-context event wiring
import { EventHandlerRegistry } from './bootstrap/event-handler-registry';
import { NotificationTriggerConsumer } from './consumers/notification-trigger.consumer';
import { AuditLoggerConsumer } from './consumers/audit-logger.consumer';
import { ProfileCreatorConsumer } from './consumers/profile-creator.consumer';
import { BlockContentFilterConsumer } from './consumers/block-content-filter.consumer';

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

    // Core infrastructure
    DatabaseModule,
    RedisModule,
    AuthModule,
    MessagingModule,
    ObservabilityModule,

    // Bounded context infrastructure (TypeORM entities + repositories)
    IdentityInfrastructureModule,
    ProfileInfrastructureModule,
    ContentInfrastructureModule,
    SocialGraphInfrastructureModule,
    CommunityInfrastructureModule,
    NotificationInfrastructureModule,
    AdminInfrastructureModule,

    // Application-layer context modules (use cases, controllers, DTOs)
    IdentityModule,
    ProfileModule,
    ContentModule,
    SocialGraphModule,
    CommunityModule,
    NotificationModule,
    AdminModule,
    PrivacyModule,
    UploadModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth guard (opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global rate limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Cross-context event wiring
    EventHandlerRegistry,

    // Cross-context event consumers
    NotificationTriggerConsumer,
    AuditLoggerConsumer,
    ProfileCreatorConsumer,
    BlockContentFilterConsumer,
  ],
})
export class AppModule {}
