import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { SuspendUserDto } from '../dto/suspend-user.dto';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { Setup2faDto } from '../dto/setup-2fa.dto';
import { Verify2faDto } from '../dto/verify-2fa.dto';
import { SuspendUserHandler } from '../commands/suspend-user.handler';
import { UnsuspendUserHandler } from '../commands/unsuspend-user.handler';
import { PromoteUserHandler } from '../commands/promote-user.handler';
import { DemoteUserHandler } from '../commands/demote-user.handler';
import { Setup2faHandler } from '../commands/setup-2fa.handler';
import { Verify2faHandler } from '../commands/verify-2fa.handler';
import { GetUsersHandler } from '../queries/get-users.handler';
import { GetAuditLogHandler } from '../queries/get-audit-log.handler';
import { GetSecurityAlertsHandler } from '../queries/get-security-alerts.handler';
import { GetAdminStatsHandler } from '../queries/get-stats.handler';

interface AdminUserPayload {
  id: string;
  email: string;
  role: string;
  twoFactorVerified: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly suspendUserHandler: SuspendUserHandler,
    private readonly unsuspendUserHandler: UnsuspendUserHandler,
    private readonly promoteUserHandler: PromoteUserHandler,
    private readonly demoteUserHandler: DemoteUserHandler,
    private readonly setup2faHandler: Setup2faHandler,
    private readonly verify2faHandler: Verify2faHandler,
    private readonly getUsersHandler: GetUsersHandler,
    private readonly getAuditLogHandler: GetAuditLogHandler,
    private readonly getSecurityAlertsHandler: GetSecurityAlertsHandler,
    private readonly getAdminStatsHandler: GetAdminStatsHandler,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin dashboard summary stats' })
  @ApiResponse({ status: 200, description: 'Aggregate counts' })
  async getStats() {
    return this.getAdminStatsHandler.execute();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsers(@Query() query: AuditLogQueryDto) {
    return this.getUsersHandler.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Put('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a user' })
  @ApiParam({ name: 'id', description: 'User UUID to suspend' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Cannot suspend user in current state' })
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.suspendUserHandler.execute({
      adminId: admin.id,
      targetUserId: id,
      reason: dto.reason,
      ipAddress,
    });
  }

  @Put('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsuspend a user' })
  @ApiParam({ name: 'id', description: 'User UUID to unsuspend' })
  @ApiResponse({ status: 200, description: 'User unsuspended' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Cannot unsuspend user in current state' })
  async unsuspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.unsuspendUserHandler.execute({
      adminId: admin.id,
      targetUserId: id,
      ipAddress,
    });
  }

  @Post('users/:id/promote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant admin privileges to a user' })
  @ApiParam({ name: 'id', description: 'User UUID to promote' })
  @ApiResponse({ status: 200, description: 'User promoted to admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async promoteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.promoteUserHandler.execute({
      adminId: admin.id,
      targetUserId: id,
      ipAddress,
    });
  }

  @Post('users/:id/demote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke admin privileges from a user' })
  @ApiParam({ name: 'id', description: 'User UUID to demote' })
  @ApiResponse({ status: 200, description: 'User demoted from admin' })
  @ApiResponse({ status: 403, description: 'An admin cannot demote themselves' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async demoteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.demoteUserHandler.execute({
      adminId: admin.id,
      targetUserId: id,
      ipAddress,
    });
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit log (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated audit log' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuditLog(@Query() query: AuditLogQueryDto) {
    return this.getAuditLogHandler.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      action: query.action,
      actorId: query.actorId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @Get('security-alerts')
  @ApiOperation({ summary: 'Get security alerts' })
  @ApiResponse({ status: 200, description: 'Paginated security alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSecurityAlerts(@Query() query: AuditLogQueryDto) {
    return this.getSecurityAlertsHandler.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup 2FA for admin account' })
  @ApiResponse({ status: 200, description: '2FA setup initiated' })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  async setup2fa(
    @Body() dto: Setup2faDto,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.setup2faHandler.execute({
      adminId: admin.id,
      verificationCode: dto.code,
      ipAddress,
    });
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA setup' })
  @ApiResponse({ status: 200, description: '2FA verified' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code' })
  async verify2fa(
    @Body() dto: Verify2faDto,
    @Req() req: Request,
  ) {
    const admin = this.getAdminUser(req);
    const ipAddress = this.extractIpAddress(req);

    return this.verify2faHandler.execute({
      adminId: admin.id,
      code: dto.code,
      ipAddress,
    });
  }

  private getAdminUser(req: Request): AdminUserPayload {
    return (req as unknown as Record<string, unknown>)['adminUser'] as AdminUserPayload;
  }

  private extractIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? '127.0.0.1';
  }
}
