import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AdminController } from '../controllers/admin.controller';
import { SuspendUserHandler } from '../commands/suspend-user.handler';
import { UnsuspendUserHandler } from '../commands/unsuspend-user.handler';
import { Setup2faHandler } from '../commands/setup-2fa.handler';
import { Verify2faHandler } from '../commands/verify-2fa.handler';
import { GetUsersHandler } from '../queries/get-users.handler';
import { GetAuditLogHandler } from '../queries/get-audit-log.handler';
import { GetSecurityAlertsHandler } from '../queries/get-security-alerts.handler';
import { AdminUserResponseDto, AuditLogResponseDto, SecurityAlertResponseDto } from '../dto/admin-response.dto';
import { SuspendUserDto } from '../dto/suspend-user.dto';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { Setup2faDto } from '../dto/setup-2fa.dto';
import { Verify2faDto } from '../dto/verify-2fa.dto';
import type { Request } from 'express';

function createMockRequest(adminId = 'admin-uuid-1'): Request {
  return {
    headers: { 'x-forwarded-for': '192.168.1.100' },
    ip: '127.0.0.1',
    adminUser: {
      id: adminId,
      email: 'admin@example.com',
      role: 'ADMIN',
      twoFactorVerified: true,
    },
  } as unknown as Request;
}

function createMockAdminUserResponse(): AdminUserResponseDto {
  const dto = new AdminUserResponseDto();
  dto.id = 'user-uuid-1';
  dto.email = 'user@example.com';
  dto.displayName = 'Test User';
  dto.status = 'ACTIVE';
  dto.failedLoginAttempts = 0;
  dto.lastLoginAt = null;
  dto.createdAt = '2024-01-15T10:30:00.000Z';
  return dto;
}

function createMockPaginatedUsers() {
  return {
    items: [createMockAdminUserResponse()],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function createMockPaginatedAuditLog() {
  const entry = new AuditLogResponseDto();
  entry.id = 'audit-uuid-1';
  entry.action = 'SUSPEND_USER';
  entry.performedBy = 'admin-uuid-1';
  entry.targetId = 'user-uuid-1';
  entry.targetType = 'Member';
  entry.details = { reason: 'Violated guidelines' };
  entry.ipAddress = '192.168.1.100';
  entry.createdAt = '2024-03-15T10:30:00.000Z';

  return {
    items: [entry],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function createMockPaginatedAlerts() {
  const alert = new SecurityAlertResponseDto();
  alert.id = 'alert-uuid-1';
  alert.severity = 'HIGH';
  alert.description = 'Admin login failed: Invalid password';
  alert.action = 'ADMIN_LOGIN_FAILED';
  alert.actorId = 'admin-uuid-1';
  alert.ipAddress = '192.168.1.100';
  alert.createdAt = '2024-03-15T10:30:00.000Z';

  return {
    items: [alert],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

describe('AdminController', () => {
  let controller: AdminController;
  let suspendUserHandler: { execute: ReturnType<typeof vi.fn> };
  let unsuspendUserHandler: { execute: ReturnType<typeof vi.fn> };
  let setup2faHandler: { execute: ReturnType<typeof vi.fn> };
  let verify2faHandler: { execute: ReturnType<typeof vi.fn> };
  let getUsersHandler: { execute: ReturnType<typeof vi.fn> };
  let getAuditLogHandler: { execute: ReturnType<typeof vi.fn> };
  let getSecurityAlertsHandler: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    suspendUserHandler = { execute: vi.fn() };
    unsuspendUserHandler = { execute: vi.fn() };
    setup2faHandler = { execute: vi.fn() };
    verify2faHandler = { execute: vi.fn() };
    getUsersHandler = { execute: vi.fn() };
    getAuditLogHandler = { execute: vi.fn() };
    getSecurityAlertsHandler = { execute: vi.fn() };

    controller = new AdminController(
      suspendUserHandler as unknown as SuspendUserHandler,
      unsuspendUserHandler as unknown as UnsuspendUserHandler,
      setup2faHandler as unknown as Setup2faHandler,
      verify2faHandler as unknown as Verify2faHandler,
      getUsersHandler as unknown as GetUsersHandler,
      getAuditLogHandler as unknown as GetAuditLogHandler,
      getSecurityAlertsHandler as unknown as GetSecurityAlertsHandler,
    );
  });

  // ─── GET /api/admin/users ───

  describe('GET /api/admin/users', () => {
    it('should return paginated user list', async () => {
      const expected = createMockPaginatedUsers();
      getUsersHandler.execute.mockResolvedValue(expected);

      const query = Object.assign(new AuditLogQueryDto(), { page: 1, limit: 20 });
      const result = await controller.getUsers(query);

      expect(result).toBe(expected);
      expect(getUsersHandler.execute).toHaveBeenCalledTimes(1);
      expect(getUsersHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('should use default pagination when no params provided', async () => {
      const expected = createMockPaginatedUsers();
      getUsersHandler.execute.mockResolvedValue(expected);

      const query = new AuditLogQueryDto();
      const result = await controller.getUsers(query);

      expect(result).toBe(expected);
      expect(getUsersHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  // ─── PUT /api/admin/users/:id/suspend ───

  describe('PUT /api/admin/users/:id/suspend', () => {
    it('should suspend a user and return updated user', async () => {
      const suspendedUser = createMockAdminUserResponse();
      suspendedUser.status = 'SUSPENDED';
      suspendUserHandler.execute.mockResolvedValue(suspendedUser);

      const dto = Object.assign(new SuspendUserDto(), {
        reason: 'Repeated violation of community guidelines',
      });
      const req = createMockRequest();

      const result = await controller.suspendUser('user-uuid-1', dto, req);

      expect(result.status).toBe('SUSPENDED');
      expect(suspendUserHandler.execute).toHaveBeenCalledTimes(1);
      expect(suspendUserHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-uuid-1',
          targetUserId: 'user-uuid-1',
          reason: 'Repeated violation of community guidelines',
          ipAddress: '192.168.1.100',
        }),
      );
    });

    it('should propagate NotFoundException when user does not exist', async () => {
      suspendUserHandler.execute.mockRejectedValue(
        new NotFoundException('Member with id user-uuid-999 not found'),
      );

      const dto = Object.assign(new SuspendUserDto(), {
        reason: 'Some valid reason for suspending user',
      });
      const req = createMockRequest();

      await expect(
        controller.suspendUser('user-uuid-999', dto, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ConflictException when user cannot be suspended', async () => {
      suspendUserHandler.execute.mockRejectedValue(
        new ConflictException('Cannot suspend member'),
      );

      const dto = Object.assign(new SuspendUserDto(), {
        reason: 'Some valid reason for suspending user',
      });
      const req = createMockRequest();

      await expect(
        controller.suspendUser('user-uuid-1', dto, req),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── PUT /api/admin/users/:id/unsuspend ───

  describe('PUT /api/admin/users/:id/unsuspend', () => {
    it('should unsuspend a user and return updated user', async () => {
      const unsuspendedUser = createMockAdminUserResponse();
      unsuspendedUser.status = 'ACTIVE';
      unsuspendUserHandler.execute.mockResolvedValue(unsuspendedUser);

      const req = createMockRequest();
      const result = await controller.unsuspendUser('user-uuid-1', req);

      expect(result.status).toBe('ACTIVE');
      expect(unsuspendUserHandler.execute).toHaveBeenCalledTimes(1);
      expect(unsuspendUserHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-uuid-1',
          targetUserId: 'user-uuid-1',
          ipAddress: '192.168.1.100',
        }),
      );
    });

    it('should propagate NotFoundException when user does not exist', async () => {
      unsuspendUserHandler.execute.mockRejectedValue(
        new NotFoundException('Member with id user-uuid-999 not found'),
      );

      const req = createMockRequest();

      await expect(
        controller.unsuspendUser('user-uuid-999', req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── GET /api/admin/audit-log ───

  describe('GET /api/admin/audit-log', () => {
    it('should return paginated audit log', async () => {
      const expected = createMockPaginatedAuditLog();
      getAuditLogHandler.execute.mockResolvedValue(expected);

      const query = Object.assign(new AuditLogQueryDto(), { page: 1, limit: 20 });
      const result = await controller.getAuditLog(query);

      expect(result).toBe(expected);
      expect(getAuditLogHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('should pass filter parameters to the handler', async () => {
      const expected = createMockPaginatedAuditLog();
      getAuditLogHandler.execute.mockResolvedValue(expected);

      const query = Object.assign(new AuditLogQueryDto(), {
        page: 1,
        limit: 10,
        action: 'SUSPEND_USER',
        actorId: 'admin-uuid-1',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      });

      await controller.getAuditLog(query);

      expect(getAuditLogHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          action: 'SUSPEND_USER',
          actorId: 'admin-uuid-1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-12-31T23:59:59.999Z',
        }),
      );
    });
  });

  // ─── GET /api/admin/security-alerts ───

  describe('GET /api/admin/security-alerts', () => {
    it('should return paginated security alerts', async () => {
      const expected = createMockPaginatedAlerts();
      getSecurityAlertsHandler.execute.mockResolvedValue(expected);

      const query = Object.assign(new AuditLogQueryDto(), { page: 1, limit: 20 });
      const result = await controller.getSecurityAlerts(query);

      expect(result).toBe(expected);
      expect(getSecurityAlertsHandler.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ─── POST /api/admin/2fa/setup ───

  describe('POST /api/admin/2fa/setup', () => {
    it('should setup 2FA and return success', async () => {
      const expected = { enabled: true, message: 'Two-factor authentication has been enabled' };
      setup2faHandler.execute.mockResolvedValue(expected);

      const dto = Object.assign(new Setup2faDto(), { code: '123456' });
      const req = createMockRequest();
      const result = await controller.setup2fa(dto, req);

      expect(result.enabled).toBe(true);
      expect(setup2faHandler.execute).toHaveBeenCalledTimes(1);
      expect(setup2faHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-uuid-1',
          verificationCode: '123456',
          ipAddress: '192.168.1.100',
        }),
      );
    });
  });

  // ─── POST /api/admin/2fa/verify ───

  describe('POST /api/admin/2fa/verify', () => {
    it('should verify 2FA and return token', async () => {
      const expected = { accessToken: 'new-token', adminId: 'admin-uuid-1' };
      verify2faHandler.execute.mockResolvedValue(expected);

      const dto = Object.assign(new Verify2faDto(), { code: '654321' });
      const req = createMockRequest();
      const result = await controller.verify2fa(dto, req);

      expect(result.accessToken).toBe('new-token');
      expect(verify2faHandler.execute).toHaveBeenCalledTimes(1);
      expect(verify2faHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-uuid-1',
          code: '654321',
          ipAddress: '192.168.1.100',
        }),
      );
    });
  });

  // ─── IP Address extraction ───

  describe('IP address extraction', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const expected = createMockAdminUserResponse();
      expected.status = 'SUSPENDED';
      suspendUserHandler.execute.mockResolvedValue(expected);

      const req = createMockRequest();
      (req.headers as Record<string, string>)['x-forwarded-for'] = '10.0.0.1, 172.16.0.1';

      const dto = Object.assign(new SuspendUserDto(), {
        reason: 'Repeated violation of community guidelines',
      });

      await controller.suspendUser('user-uuid-1', dto, req);

      expect(suspendUserHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '10.0.0.1' }),
      );
    });

    it('should fall back to req.ip when no x-forwarded-for', async () => {
      const expected = createMockAdminUserResponse();
      expected.status = 'SUSPENDED';
      suspendUserHandler.execute.mockResolvedValue(expected);

      const req = {
        headers: {},
        ip: '192.168.0.55',
        adminUser: {
          id: 'admin-uuid-1',
          email: 'admin@example.com',
          role: 'ADMIN',
          twoFactorVerified: true,
        },
      } as unknown as Request;

      const dto = Object.assign(new SuspendUserDto(), {
        reason: 'Repeated violation of community guidelines',
      });

      await controller.suspendUser('user-uuid-1', dto, req);

      expect(suspendUserHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '192.168.0.55' }),
      );
    });
  });
});
