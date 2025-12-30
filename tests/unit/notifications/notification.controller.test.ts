/**
 * NotificationController Unit Tests
 * TDD London School - Outside-In with Mocks
 * SPARC Phase 4 - M7 Notifications Module
 */

import { NotificationController } from '../../../src/notifications/notification.controller';
import { NotificationService } from '../../../src/notifications/notification.service';
import { PreferenceService } from '../../../src/notifications/preference.service';
import { WebSocketService } from '../../../src/notifications/websocket.service';
import {
  Notification,
  NotificationPreference,
  PaginatedResponse,
  MarkAsReadResult,
  MarkAllAsReadResult,
} from '../../../src/notifications/notification.types';

// Mock Request and Response
interface MockRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
  user?: { id: string };
}

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  params: {},
  query: {},
  body: {},
  user: { id: 'user-456' },
  ...overrides,
});

const createMockResponse = (): MockResponse => {
  const res = {} as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-123',
  recipientId: 'user-456',
  actorId: 'user-789',
  entityId: 'post-abc',
  entityType: 'Post',
  type: 'like',
  title: 'New Like',
  body: 'John liked your post',
  data: {},
  isRead: false,
  priority: 1,
  createdAt: new Date('2025-12-30T10:00:00Z'),
  ...overrides,
});

const createMockPreference = (
  overrides: Partial<NotificationPreference> = {}
): NotificationPreference => ({
  id: 'pref-123',
  userId: 'user-456',
  notificationType: 'like',
  channel: 'websocket',
  enabled: true,
  frequency: 'instant',
  createdAt: new Date('2025-12-01T00:00:00Z'),
  updatedAt: new Date('2025-12-01T00:00:00Z'),
  ...overrides,
});

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockPreferenceService: jest.Mocked<PreferenceService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    mockNotificationService = {
      getNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
      deleteNotification: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    mockPreferenceService = {
      getUserPreferences: jest.fn(),
      updatePreference: jest.fn(),
      bulkUpdatePreferences: jest.fn(),
    } as unknown as jest.Mocked<PreferenceService>;

    mockWebSocketService = {
      sendUnreadCount: jest.fn(),
      sendReadNotification: jest.fn(),
    } as unknown as jest.Mocked<WebSocketService>;

    controller = new NotificationController(
      mockNotificationService,
      mockPreferenceService,
      mockWebSocketService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return paginated notifications for user', async () => {
      // Arrange
      const req = createMockRequest({
        query: { page: '1', limit: '20' },
      });
      const res = createMockResponse();
      const mockPaginatedResponse: PaginatedResponse<Notification> = {
        data: [createMockNotification(), createMockNotification({ id: 'notif-456' })],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasMore: false,
        },
      };
      mockNotificationService.getNotifications.mockResolvedValue(mockPaginatedResponse);

      // Act
      await controller.getNotifications(req as any, res as any);

      // Assert
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user-456',
        {},
        { page: 1, limit: 20 }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        ...mockPaginatedResponse,
      });
    });

    it('should filter by unreadOnly when specified', async () => {
      // Arrange
      const req = createMockRequest({
        query: { unreadOnly: 'true' },
      });
      const res = createMockResponse();
      const mockPaginatedResponse: PaginatedResponse<Notification> = {
        data: [createMockNotification({ isRead: false })],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
      };
      mockNotificationService.getNotifications.mockResolvedValue(mockPaginatedResponse);

      // Act
      await controller.getNotifications(req as any, res as any);

      // Assert
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user-456',
        { unreadOnly: true },
        expect.any(Object)
      );
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      // Act
      await controller.getNotifications(req as any, res as any);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'notif-123' },
      });
      const res = createMockResponse();
      const readAt = new Date('2025-12-30T12:00:00Z');
      const mockResult: MarkAsReadResult = {
        success: true,
        notificationId: 'notif-123',
        readAt,
      };
      mockNotificationService.markAsRead.mockResolvedValue(mockResult);

      // Act
      await controller.markAsRead(req as any, res as any);

      // Assert
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'notif-123',
        'user-456'
      );
      expect(mockWebSocketService.sendReadNotification).toHaveBeenCalledWith(
        'user-456',
        'notif-123',
        readAt
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update unread count after marking as read', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'notif-123' },
      });
      const res = createMockResponse();
      mockNotificationService.markAsRead.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        readAt: new Date(),
      });
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      // Act
      await controller.markAsRead(req as any, res as any);

      // Assert
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith('user-456');
      expect(mockWebSocketService.sendUnreadCount).toHaveBeenCalledWith('user-456', 5);
    });

    it('should return 404 if notification not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent' },
      });
      const res = createMockResponse();
      mockNotificationService.markAsRead.mockRejectedValue(
        new Error('Notification not found')
      );

      // Act
      await controller.markAsRead(req as any, res as any);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Notification not found',
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      const mockResult: MarkAllAsReadResult = {
        success: true,
        count: 5,
        readAt: new Date('2025-12-30T12:00:00Z'),
      };
      mockNotificationService.markAllAsRead.mockResolvedValue(mockResult);

      // Act
      await controller.markAllAsRead(req as any, res as any);

      // Assert
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-456');
      expect(mockWebSocketService.sendUnreadCount).toHaveBeenCalledWith('user-456', 0);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 5,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      mockNotificationService.getUnreadCount.mockResolvedValue(10);

      // Act
      await controller.getUnreadCount(req as any, res as any);

      // Assert
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith('user-456');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        unreadCount: 10,
      });
    });
  });

  describe('getPreferences', () => {
    it('should return user notification preferences', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      const mockPreferences: NotificationPreference[] = [
        createMockPreference({ notificationType: 'like' }),
        createMockPreference({ id: 'pref-456', notificationType: 'comment' }),
      ];
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);

      // Act
      await controller.getPreferences(req as any, res as any);

      // Assert
      expect(mockPreferenceService.getUserPreferences).toHaveBeenCalledWith('user-456');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        preferences: mockPreferences,
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          preferences: [
            { notificationType: 'like', channel: 'websocket', enabled: false },
            { notificationType: 'comment', channel: 'email', enabled: true },
          ],
        },
      });
      const res = createMockResponse();
      const updatedPreferences: NotificationPreference[] = [
        createMockPreference({ notificationType: 'like', enabled: false }),
        createMockPreference({
          id: 'pref-456',
          notificationType: 'comment',
          channel: 'email',
        }),
      ];
      mockPreferenceService.bulkUpdatePreferences.mockResolvedValue(updatedPreferences);

      // Act
      await controller.updatePreferences(req as any, res as any);

      // Assert
      expect(mockPreferenceService.bulkUpdatePreferences).toHaveBeenCalledWith(
        'user-456',
        req.body.preferences
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        preferences: updatedPreferences,
      });
    });

    it('should return 400 if preferences not provided', async () => {
      // Arrange
      const req = createMockRequest({
        body: {},
      });
      const res = createMockResponse();

      // Act
      await controller.updatePreferences(req as any, res as any);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Preferences array required',
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'notif-123' },
      });
      const res = createMockResponse();
      mockNotificationService.deleteNotification.mockResolvedValue(true);

      // Act
      await controller.deleteNotification(req as any, res as any);

      // Assert
      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith(
        'notif-123',
        'user-456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification deleted',
      });
    });

    it('should return 404 if notification not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent' },
      });
      const res = createMockResponse();
      mockNotificationService.deleteNotification.mockRejectedValue(
        new Error('Notification not found')
      );

      // Act
      await controller.deleteNotification(req as any, res as any);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
