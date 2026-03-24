import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @nestjs/swagger before any imports that use it
vi.mock('@nestjs/swagger', () => ({
  ApiTags: () => () => {},
  ApiBearerAuth: () => () => {},
  ApiOperation: () => () => {},
  ApiResponse: () => () => {},
  ApiProperty: () => () => {},
  ApiPropertyOptional: () => () => {},
}));

import { NotificationController } from '../controllers/notification.controller';
import { GetNotificationsHandler } from '../queries/get-notifications.handler';
import { GetUnreadCountHandler } from '../queries/get-unread-count.handler';
import { GetPreferencesHandler } from '../queries/get-preferences.handler';
import { MarkReadHandler } from '../commands/mark-read.handler';
import { MarkAllReadHandler } from '../commands/mark-all-read.handler';
import { UpdatePreferencesHandler } from '../commands/update-preferences.handler';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';

describe('NotificationController', () => {
  let controller: NotificationController;
  let getNotificationsHandler: { execute: ReturnType<typeof vi.fn> };
  let getUnreadCountHandler: { execute: ReturnType<typeof vi.fn> };
  let getPreferencesHandler: { execute: ReturnType<typeof vi.fn> };
  let markReadHandler: { execute: ReturnType<typeof vi.fn> };
  let markAllReadHandler: { execute: ReturnType<typeof vi.fn> };
  let updatePreferencesHandler: { execute: ReturnType<typeof vi.fn> };

  const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(() => {
    getNotificationsHandler = { execute: vi.fn() };
    getUnreadCountHandler = { execute: vi.fn() };
    getPreferencesHandler = { execute: vi.fn() };
    markReadHandler = { execute: vi.fn() };
    markAllReadHandler = { execute: vi.fn() };
    updatePreferencesHandler = { execute: vi.fn() };

    controller = new NotificationController(
      getNotificationsHandler as unknown as GetNotificationsHandler,
      getUnreadCountHandler as unknown as GetUnreadCountHandler,
      getPreferencesHandler as unknown as GetPreferencesHandler,
      markReadHandler as unknown as MarkReadHandler,
      markAllReadHandler as unknown as MarkAllReadHandler,
      updatePreferencesHandler as unknown as UpdatePreferencesHandler,
    );
  });

  describe('GET /api/notifications', () => {
    it('should delegate to GetNotificationsHandler with default pagination', async () => {
      const paginatedResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
      getNotificationsHandler.execute.mockResolvedValue(paginatedResult);

      const query = new NotificationQueryDto();
      const result = await controller.getNotifications(userId, query);

      expect(getNotificationsHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: userId,
          page: 1,
          pageSize: 20,
          unreadOnly: false,
        }),
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should pass query params to handler', async () => {
      const paginatedResult = {
        items: [{ id: 'n1', type: 'FOLLOW', status: 'UNREAD' }],
        total: 1,
        page: 2,
        pageSize: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      };
      getNotificationsHandler.execute.mockResolvedValue(paginatedResult);

      const query = new NotificationQueryDto();
      query.cursor = 2;
      query.limit = 10;
      query.unreadOnly = true;

      const result = await controller.getNotifications(userId, query);

      expect(getNotificationsHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: userId,
          page: 2,
          pageSize: 10,
          unreadOnly: true,
        }),
      );
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      getUnreadCountHandler.execute.mockResolvedValue(7);

      const result = await controller.getUnreadCount(userId);

      expect(getUnreadCountHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: userId }),
      );
      expect(result).toEqual({ count: 7 });
    });

    it('should return zero when no unread notifications', async () => {
      getUnreadCountHandler.execute.mockResolvedValue(0);

      const result = await controller.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should delegate to MarkReadHandler', async () => {
      markReadHandler.execute.mockResolvedValue(undefined);
      const alertId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

      await controller.markAsRead(alertId, userId);

      expect(markReadHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          alertId,
          memberId: userId,
        }),
      );
    });

    it('should propagate NotFoundException from handler', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      markReadHandler.execute.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(
        controller.markAsRead('nonexistent-uuid-0000-0000-000000000000', userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ForbiddenException when notification belongs to another user', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      markReadHandler.execute.mockRejectedValue(
        new ForbiddenException("Cannot mark another member's notification as read"),
      );

      await expect(
        controller.markAsRead('b2c3d4e5-f6a7-8901-bcde-f12345678901', userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should delegate to MarkAllReadHandler and return count', async () => {
      markAllReadHandler.execute.mockResolvedValue(5);

      const result = await controller.markAllAsRead(userId);

      expect(markAllReadHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: userId }),
      );
      expect(result).toEqual({ markedCount: 5 });
    });

    it('should return zero when no unread notifications', async () => {
      markAllReadHandler.execute.mockResolvedValue(0);

      const result = await controller.markAllAsRead(userId);

      expect(result).toEqual({ markedCount: 0 });
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should delegate to GetPreferencesHandler', async () => {
      const preferenceResponse = {
        id: 'pref-id',
        memberId: userId,
        preferences: {
          FOLLOW: ['IN_APP', 'EMAIL'],
          LIKE: ['IN_APP'],
        },
      };
      getPreferencesHandler.execute.mockResolvedValue(preferenceResponse);

      const result = await controller.getPreferences(userId);

      expect(getPreferencesHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: userId }),
      );
      expect(result).toEqual(preferenceResponse);
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should delegate to UpdatePreferencesHandler', async () => {
      updatePreferencesHandler.execute.mockResolvedValue(undefined);

      const dto = new UpdatePreferencesDto();
      dto.preferences = {
        FOLLOW: ['IN_APP', 'EMAIL'],
        LIKE: ['IN_APP'],
      };

      await controller.updatePreferences(userId, dto);

      expect(updatePreferencesHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: userId,
          preferences: {
            FOLLOW: ['IN_APP', 'EMAIL'],
            LIKE: ['IN_APP'],
          },
        }),
      );
    });

    it('should propagate BadRequestException for invalid preferences', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      updatePreferencesHandler.execute.mockRejectedValue(
        new BadRequestException('Invalid alert type: INVALID'),
      );

      const dto = new UpdatePreferencesDto();
      dto.preferences = { INVALID: ['IN_APP'] };

      await expect(controller.updatePreferences(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
