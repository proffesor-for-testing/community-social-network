import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminInfrastructureModule } from '@csn/infra-admin';
import { IdentityInfrastructureModule, MemberEntity } from '@csn/infra-identity';
import { AuditEntryEntity } from '@csn/infra-admin';
import { PublicationEntity, ReactionEntity } from '@csn/infra-content';
import { GroupEntity } from '@csn/infra-community';

// Controllers
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminController } from './controllers/admin.controller';

// Command Handlers
import { AdminLoginHandler } from './commands/admin-login.handler';
import { Verify2faHandler } from './commands/verify-2fa.handler';
import { SuspendUserHandler } from './commands/suspend-user.handler';
import { UnsuspendUserHandler } from './commands/unsuspend-user.handler';
import { Setup2faHandler } from './commands/setup-2fa.handler';

// Query Handlers
import { GetUsersHandler } from './queries/get-users.handler';
import { GetAuditLogHandler } from './queries/get-audit-log.handler';
import { GetSecurityAlertsHandler } from './queries/get-security-alerts.handler';
import { GetAdminStatsHandler } from './queries/get-stats.handler';

// Guards
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [
    AdminInfrastructureModule,
    IdentityInfrastructureModule,
    TypeOrmModule.forFeature([
      MemberEntity,
      AuditEntryEntity,
      PublicationEntity,
      ReactionEntity,
      GroupEntity,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'admin-jwt-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [
    // Guards
    AdminAuthGuard,
    // Command Handlers
    AdminLoginHandler,
    Verify2faHandler,
    SuspendUserHandler,
    UnsuspendUserHandler,
    Setup2faHandler,
    // Query Handlers
    GetUsersHandler,
    GetAuditLogHandler,
    GetSecurityAlertsHandler,
    GetAdminStatsHandler,
  ],
  exports: [AdminAuthGuard],
})
export class AdminModule {}
