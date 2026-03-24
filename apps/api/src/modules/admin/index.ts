// Module
export { AdminModule } from './admin.module';

// DTOs
export { AdminLoginDto } from './dto/admin-login.dto';
export { Verify2faDto } from './dto/verify-2fa.dto';
export { SuspendUserDto } from './dto/suspend-user.dto';
export { AuditLogQueryDto } from './dto/audit-log-query.dto';
export { Setup2faDto } from './dto/setup-2fa.dto';
export {
  AdminUserResponseDto,
  AuditLogResponseDto,
  SecurityAlertResponseDto,
} from './dto/admin-response.dto';

// Commands
export { AdminLoginCommand } from './commands/admin-login.command';
export { Verify2faCommand } from './commands/verify-2fa.command';
export { SuspendUserCommand } from './commands/suspend-user.command';
export { UnsuspendUserCommand } from './commands/unsuspend-user.command';
export { Setup2faCommand } from './commands/setup-2fa.command';

// Command Handlers
export { AdminLoginHandler } from './commands/admin-login.handler';
export { Verify2faHandler } from './commands/verify-2fa.handler';
export { SuspendUserHandler } from './commands/suspend-user.handler';
export { UnsuspendUserHandler } from './commands/unsuspend-user.handler';
export { Setup2faHandler } from './commands/setup-2fa.handler';

// Queries
export { GetUsersQuery } from './queries/get-users.query';
export { GetAuditLogQuery } from './queries/get-audit-log.query';
export { GetSecurityAlertsQuery } from './queries/get-security-alerts.query';

// Query Handlers
export { GetUsersHandler } from './queries/get-users.handler';
export { GetAuditLogHandler } from './queries/get-audit-log.handler';
export { GetSecurityAlertsHandler } from './queries/get-security-alerts.handler';

// Guards
export { AdminAuthGuard } from './guards/admin-auth.guard';

// Controllers
export { AdminAuthController } from './controllers/admin-auth.controller';
export { AdminController } from './controllers/admin.controller';
