/**
 * NotificationService Unit Tests
 * TDD London School - Outside-In with Mocks
 * SPARC Phase 4 - M7 Notifications Module
 */

import { NotificationService } from '../../../src/notifications/notification.service';
import {
  CreateNotificationInput,
  Notification,
  NotificationType,
  NotificationPriority,
  INotificationRepository,
  IPreferenceRepository,
  PaginatedResponse,
  MarkAsReadResult,
  MarkAllAsReadResult,
  NotificationPreference,
  DeduplicationKey,
} from '../../../src/notifications/notification.types';

// Mock factory for creating test data
const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-123',
  recipientId: 'user-456',
  actorId: 'user-789',
  entityId: 'post-abc',
  entityType: 'Post',
  type: 'like',
  title: 'New Like',
  body: 'John liked your post',
  data: { postTitle: 'My awesome post' },
  isRead: false,
  priority: 1,
  createdAt: new Date('2025-12-30T10:00:00Z'),
  ...overrides,
});

const createMockPreference = (overrides: Partial<NotificationPreference> = {}): NotificationPreference => ({
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

describe('NotificationService', () => {
  let service: NotificationService;
  let mockNotificationRepo: jest.Mocked<INotificationRepository>;
  let mockPreferenceRepo: jest.Mocked<IPreferenceRepository>;

  beforeEach(() => {
    // Create mock repositories following London School approach
    mockNotificationRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
      delete: jest.fn(),
      findDuplicate: jest.fn(),
    };

    mockPreferenceRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndType: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    service = new NotificationService(mockNotificationRepo, mockPreferenceRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    const validInput: CreateNotificationInput = {
      recipientId: 'user-456',
      actorId: 'user-789',
      entityId: 'post-abc',
      entityType: 'Post',
      type: 'like',
      title: 'New Like',
      body: 'John liked your post',
    };

    it('should persist notification to database', async () => {
      // Arrange
      const expectedNotification = createMockNotification();
      mockNotificationRepo.create.mockResolvedValue(expectedNotification);
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ enabled: true }),
      ]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);

      // Act
      const result = await service.createNotification(validInput);

      // Assert - Verify interaction with repository
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: validInput.recipientId,
          actorId: validInput.actorId,
          type: validInput.type,
        })
      );
      expect(result).toEqual(expectedNotification);
    });

    it('should check user preferences before creating notification', async () => {
      // Arrange
      const expectedNotification = createMockNotification();
      mockNotificationRepo.create.mockResolvedValue(expectedNotification);
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ enabled: true }),
      ]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);

      // Act
      await service.createNotification(validInput);

      // Assert - Verify preference check happens
      expect(mockPreferenceRepo.findByUserIdAndType).toHaveBeenCalledWith(
        validInput.recipientId,
        validInput.type
      );
    });

    it('should skip notification if user has disabled this type', async () => {
      // Arrange
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ enabled: false }),
      ]);

      // Act
      const result = await service.createNotification(validInput);

      // Assert
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should deduplicate notifications within time window', async () => {
      // Arrange
      const existingNotification = createMockNotification();
      mockNotificationRepo.findDuplicate.mockResolvedValue(existingNotification);
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ enabled: true }),
      ]);

      // Act
      const result = await service.createNotification(validInput);

      // Assert - Should return existing notification, not create new
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingNotification);
    });

    it('should set default priority to normal (1) if not specified', async () => {
      // Arrange
      const expectedNotification = createMockNotification({ priority: 1 });
      mockNotificationRepo.create.mockResolvedValue(expectedNotification);
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);

      // Act
      await service.createNotification(validInput);

      // Assert
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 1,
        })
      );
    });

    it('should allow notifications when no preferences exist (default enabled)', async () => {
      // Arrange
      const expectedNotification = createMockNotification();
      mockNotificationRepo.create.mockResolvedValue(expectedNotification);
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);

      // Act
      const result = await service.createNotification(validInput);

      // Assert
      expect(mockNotificationRepo.create).toHaveBeenCalled();
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('getNotifications', () => {
    const userId = 'user-456';

    it('should return paginated list of notifications', async () => {
      // Arrange
      const mockNotifications: PaginatedResponse<Notification> = {
        data: [createMockNotification(), createMockNotification({ id: 'notif-456' })],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasMore: false,
        },
      };
      mockNotificationRepo.findByUserId.mockResolvedValue(mockNotifications);

      // Act
      const result = await service.getNotifications(userId, {}, { page: 1, limit: 20 });

      // Assert
      expect(mockNotificationRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        {},
        { page: 1, limit: 20 }
      );
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by unread only when specified', async () => {
      // Arrange
      const mockNotifications: PaginatedResponse<Notification> = {
        data: [createMockNotification({ isRead: false })],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      };
      mockNotificationRepo.findByUserId.mockResolvedValue(mockNotifications);

      // Act
      await service.getNotifications(userId, { unreadOnly: true }, { page: 1, limit: 20 });

      // Assert
      expect(mockNotificationRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        { unreadOnly: true },
        { page: 1, limit: 20 }
      );
    });

    it('should use default pagination when not specified', async () => {
      // Arrange
      const mockNotifications: PaginatedResponse<Notification> = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      };
      mockNotificationRepo.findByUserId.mockResolvedValue(mockNotifications);

      // Act
      await service.getNotifications(userId);

      // Assert
      expect(mockNotificationRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        {},
        { page: 1, limit: 20 }
      );
    });
  });

  describe('markAsRead', () => {
    it('should update notification status to read', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const userId = 'user-456';
      const readAt = new Date('2025-12-30T12:00:00Z');
      const mockResult: MarkAsReadResult = {
        success: true,
        notificationId,
        readAt,
      };

      mockNotificationRepo.findById.mockResolvedValue(
        createMockNotification({ id: notificationId, recipientId: userId })
      );
      mockNotificationRepo.markAsRead.mockResolvedValue(mockResult);

      // Act
      const result = await service.markAsRead(notificationId, userId);

      // Assert
      expect(mockNotificationRepo.markAsRead).toHaveBeenCalledWith(notificationId);
      expect(result.success).toBe(true);
      expect(result.readAt).toEqual(readAt);
    });

    it('should throw error if notification not found', async () => {
      // Arrange
      mockNotificationRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.markAsRead('non-existent', 'user-456')
      ).rejects.toThrow('Notification not found');
    });

    it('should throw error if user does not own notification', async () => {
      // Arrange
      mockNotificationRepo.findById.mockResolvedValue(
        createMockNotification({ recipientId: 'other-user' })
      );

      // Act & Assert
      await expect(
        service.markAsRead('notif-123', 'user-456')
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      // Arrange
      const userId = 'user-456';
      const readAt = new Date('2025-12-30T12:00:00Z');
      const mockResult: MarkAllAsReadResult = {
        success: true,
        count: 5,
        readAt,
      };
      mockNotificationRepo.markAllAsRead.mockResolvedValue(mockResult);

      // Act
      const result = await service.markAllAsRead(userId);

      // Assert
      expect(mockNotificationRepo.markAllAsRead).toHaveBeenCalledWith(userId);
      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    });

    it('should return zero count if no unread notifications', async () => {
      // Arrange
      const mockResult: MarkAllAsReadResult = {
        success: true,
        count: 0,
        readAt: new Date(),
      };
      mockNotificationRepo.markAllAsRead.mockResolvedValue(mockResult);

      // Act
      const result = await service.markAllAsRead('user-456');

      // Assert
      expect(result.count).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Arrange
      mockNotificationRepo.getUnreadCount.mockResolvedValue(10);

      // Act
      const count = await service.getUnreadCount('user-456');

      // Assert
      expect(mockNotificationRepo.getUnreadCount).toHaveBeenCalledWith('user-456');
      expect(count).toBe(10);
    });
  });

  describe('preference filtering', () => {
    const createInputForType = (type: NotificationType): CreateNotificationInput => ({
      recipientId: 'user-456',
      actorId: 'user-789',
      entityType: 'Post',
      type,
      title: `New ${type}`,
      body: `Test ${type} notification`,
    });

    it('should check preferences for mention notifications', async () => {
      // Arrange
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ notificationType: 'mention', enabled: true }),
      ]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);
      mockNotificationRepo.create.mockResolvedValue(createMockNotification({ type: 'mention' }));

      // Act
      await service.createNotification(createInputForType('mention'));

      // Assert
      expect(mockPreferenceRepo.findByUserIdAndType).toHaveBeenCalledWith('user-456', 'mention');
    });

    it('should check preferences for follow notifications', async () => {
      // Arrange
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ notificationType: 'follow', enabled: true }),
      ]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);
      mockNotificationRepo.create.mockResolvedValue(createMockNotification({ type: 'follow' }));

      // Act
      await service.createNotification(createInputForType('follow'));

      // Assert
      expect(mockPreferenceRepo.findByUserIdAndType).toHaveBeenCalledWith('user-456', 'follow');
    });

    it('should check preferences for group_invite notifications', async () => {
      // Arrange
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([
        createMockPreference({ notificationType: 'group_invite', enabled: true }),
      ]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);
      mockNotificationRepo.create.mockResolvedValue(createMockNotification({ type: 'group_invite' }));

      // Act
      await service.createNotification(createInputForType('group_invite'));

      // Assert
      expect(mockPreferenceRepo.findByUserIdAndType).toHaveBeenCalledWith('user-456', 'group_invite');
    });
  });

  describe('deduplication', () => {
    it('should check for duplicate within 5 minute window by default', async () => {
      // Arrange
      const input: CreateNotificationInput = {
        recipientId: 'user-456',
        actorId: 'user-789',
        entityId: 'post-abc',
        entityType: 'Post',
        type: 'like',
        title: 'New Like',
        body: 'Test',
      };
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(null);
      mockNotificationRepo.create.mockResolvedValue(createMockNotification());

      // Act
      await service.createNotification(input);

      // Assert - Verify deduplication check with correct key
      expect(mockNotificationRepo.findDuplicate).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: input.recipientId,
          actorId: input.actorId,
          entityType: input.entityType,
          entityId: input.entityId,
          type: input.type,
        }),
        expect.any(Number) // Window in ms
      );
    });

    it('should return existing notification when duplicate found', async () => {
      // Arrange
      const existingNotification = createMockNotification({ id: 'existing-notif' });
      mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([]);
      mockNotificationRepo.findDuplicate.mockResolvedValue(existingNotification);

      // Act
      const result = await service.createNotification({
        recipientId: 'user-456',
        actorId: 'user-789',
        entityId: 'post-abc',
        entityType: 'Post',
        type: 'like',
        title: 'New Like',
        body: 'Test',
      });

      // Assert
      expect(result).toEqual(existingNotification);
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('notification types', () => {
    const notificationTypes: NotificationType[] = [
      'mention',
      'like',
      'comment',
      'follow',
      'group_invite',
    ];

    notificationTypes.forEach((type) => {
      it(`should create ${type} notification with correct type`, async () => {
        // Arrange
        const input: CreateNotificationInput = {
          recipientId: 'user-456',
          actorId: 'user-789',
          entityType: 'Post',
          type,
          title: `New ${type}`,
          body: `Test ${type}`,
        };
        mockPreferenceRepo.findByUserIdAndType.mockResolvedValue([]);
        mockNotificationRepo.findDuplicate.mockResolvedValue(null);
        mockNotificationRepo.create.mockResolvedValue(createMockNotification({ type }));

        // Act
        await service.createNotification(input);

        // Assert
        expect(mockNotificationRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ type })
        );
      });
    });
  });
});
