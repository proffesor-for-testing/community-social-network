/**
 * PreferenceService Unit Tests
 * TDD London School - Outside-In with Mocks
 * SPARC Phase 4 - M7 Notifications Module
 */

import { PreferenceService } from '../../../src/notifications/preference.service';
import {
  NotificationPreference,
  NotificationType,
  DeliveryChannel,
  UpdatePreferenceInput,
  IPreferenceRepository,
} from '../../../src/notifications/notification.types';

// Mock factory for test data
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

describe('PreferenceService', () => {
  let service: PreferenceService;
  let mockRepository: jest.Mocked<IPreferenceRepository>;

  beforeEach(() => {
    mockRepository = {
      findByUserId: jest.fn(),
      findByUserIdAndType: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    service = new PreferenceService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return all preferences for a user', async () => {
      // Arrange
      const userId = 'user-456';
      const mockPreferences: NotificationPreference[] = [
        createMockPreference({ notificationType: 'like' }),
        createMockPreference({ id: 'pref-456', notificationType: 'comment' }),
        createMockPreference({ id: 'pref-789', notificationType: 'follow' }),
      ];
      mockRepository.findByUserId.mockResolvedValue(mockPreferences);

      // Act
      const result = await service.getUserPreferences(userId);

      // Assert
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no preferences exist', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue([]);

      // Act
      const result = await service.getUserPreferences('user-456');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getPreferencesByType', () => {
    it('should return preferences for a specific notification type', async () => {
      // Arrange
      const userId = 'user-456';
      const type: NotificationType = 'mention';
      const mockPreferences: NotificationPreference[] = [
        createMockPreference({ notificationType: 'mention', channel: 'websocket' }),
        createMockPreference({
          id: 'pref-456',
          notificationType: 'mention',
          channel: 'email',
        }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(mockPreferences);

      // Act
      const result = await service.getPreferencesByType(userId, type);

      // Assert
      expect(mockRepository.findByUserIdAndType).toHaveBeenCalledWith(userId, type);
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.notificationType === 'mention')).toBe(true);
    });
  });

  describe('updatePreference', () => {
    it('should upsert preference when updating', async () => {
      // Arrange
      const userId = 'user-456';
      const input: UpdatePreferenceInput = {
        notificationType: 'like',
        channel: 'websocket',
        enabled: false,
      };
      const updatedPreference = createMockPreference({
        enabled: false,
        updatedAt: new Date('2025-12-30T12:00:00Z'),
      });
      mockRepository.upsert.mockResolvedValue(updatedPreference);

      // Act
      const result = await service.updatePreference(userId, input);

      // Assert
      expect(mockRepository.upsert).toHaveBeenCalledWith(userId, input);
      expect(result.enabled).toBe(false);
    });

    it('should update frequency setting', async () => {
      // Arrange
      const userId = 'user-456';
      const input: UpdatePreferenceInput = {
        notificationType: 'comment',
        channel: 'email',
        frequency: 'daily',
      };
      const updatedPreference = createMockPreference({
        notificationType: 'comment',
        channel: 'email',
        frequency: 'daily',
      });
      mockRepository.upsert.mockResolvedValue(updatedPreference);

      // Act
      const result = await service.updatePreference(userId, input);

      // Assert
      expect(result.frequency).toBe('daily');
    });

    it('should update quiet hours settings', async () => {
      // Arrange
      const userId = 'user-456';
      const input: UpdatePreferenceInput = {
        notificationType: 'message',
        channel: 'push',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      };
      const updatedPreference = createMockPreference({
        notificationType: 'message',
        channel: 'push',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });
      mockRepository.upsert.mockResolvedValue(updatedPreference);

      // Act
      const result = await service.updatePreference(userId, input);

      // Assert
      expect(result.quietHoursStart).toBe('22:00');
      expect(result.quietHoursEnd).toBe('08:00');
    });
  });

  describe('bulkUpdatePreferences', () => {
    it('should update multiple preferences at once', async () => {
      // Arrange
      const userId = 'user-456';
      const inputs: UpdatePreferenceInput[] = [
        { notificationType: 'like', channel: 'websocket', enabled: false },
        { notificationType: 'comment', channel: 'email', enabled: true },
        { notificationType: 'follow', channel: 'push', enabled: false },
      ];

      mockRepository.upsert.mockResolvedValue(createMockPreference());

      // Act
      await service.bulkUpdatePreferences(userId, inputs);

      // Assert
      expect(mockRepository.upsert).toHaveBeenCalledTimes(3);
      expect(mockRepository.upsert).toHaveBeenCalledWith(userId, inputs[0]);
      expect(mockRepository.upsert).toHaveBeenCalledWith(userId, inputs[1]);
      expect(mockRepository.upsert).toHaveBeenCalledWith(userId, inputs[2]);
    });
  });

  describe('deletePreference', () => {
    it('should delete a specific preference', async () => {
      // Arrange
      const userId = 'user-456';
      const type: NotificationType = 'like';
      const channel: DeliveryChannel = 'websocket';
      mockRepository.delete.mockResolvedValue(true);

      // Act
      const result = await service.deletePreference(userId, type, channel);

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledWith(userId, type, channel);
      expect(result).toBe(true);
    });

    it('should return false when preference not found', async () => {
      // Arrange
      mockRepository.delete.mockResolvedValue(false);

      // Act
      const result = await service.deletePreference('user-456', 'like', 'websocket');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isNotificationEnabled', () => {
    it('should return true when preference is enabled', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({ enabled: true, channel: 'websocket' }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act
      const result = await service.isNotificationEnabled('user-456', 'like', 'websocket');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when preference is disabled', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({ enabled: false, channel: 'websocket' }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act
      const result = await service.isNotificationEnabled('user-456', 'like', 'websocket');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when no preference exists (default enabled)', async () => {
      // Arrange
      mockRepository.findByUserIdAndType.mockResolvedValue([]);

      // Act
      const result = await service.isNotificationEnabled('user-456', 'like', 'websocket');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('isWithinQuietHours', () => {
    it('should return true when current time is within quiet hours', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          channel: 'push',
        }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act - Testing at 23:00 (within quiet hours)
      const testTime = new Date('2025-12-30T23:00:00Z');
      const result = await service.isWithinQuietHours('user-456', 'like', 'push', testTime);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when current time is outside quiet hours', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          channel: 'push',
        }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act - Testing at 14:00 (outside quiet hours)
      const testTime = new Date('2025-12-30T14:00:00Z');
      const result = await service.isWithinQuietHours('user-456', 'like', 'push', testTime);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when no quiet hours configured', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({ channel: 'push' }), // No quiet hours
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act
      const result = await service.isWithinQuietHours('user-456', 'like', 'push');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getDefaultPreferences', () => {
    it('should return default preferences for all notification types', () => {
      // Act
      const defaults = service.getDefaultPreferences();

      // Assert
      const notificationTypes: NotificationType[] = [
        'mention',
        'like',
        'comment',
        'follow',
        'group_invite',
        'message',
        'system',
      ];

      notificationTypes.forEach((type) => {
        expect(defaults[type]).toBeDefined();
        expect(defaults[type].websocket).toBe(true);
        expect(defaults[type].email).toBeDefined();
        expect(defaults[type].push).toBeDefined();
      });
    });

    it('should have email enabled for important notification types', () => {
      // Act
      const defaults = service.getDefaultPreferences();

      // Assert - Message and group_invite should have email enabled
      expect(defaults.message.email).toBe(true);
      expect(defaults.group_invite.email).toBe(true);
    });

    it('should have push enabled for real-time notification types', () => {
      // Act
      const defaults = service.getDefaultPreferences();

      // Assert
      expect(defaults.mention.push).toBe(true);
      expect(defaults.message.push).toBe(true);
    });
  });

  describe('shouldDeliverViaChannel', () => {
    it('should return true when channel is enabled and not in quiet hours', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({
          enabled: true,
          channel: 'websocket',
        }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act
      const result = await service.shouldDeliverViaChannel(
        'user-456',
        'like',
        'websocket'
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when channel is disabled', async () => {
      // Arrange
      const preferences: NotificationPreference[] = [
        createMockPreference({
          enabled: false,
          channel: 'websocket',
        }),
      ];
      mockRepository.findByUserIdAndType.mockResolvedValue(preferences);

      // Act
      const result = await service.shouldDeliverViaChannel(
        'user-456',
        'like',
        'websocket'
      );

      // Assert
      expect(result).toBe(false);
    });
  });
});
