/**
 * PreferenceService
 * Manages user notification preferences
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import {
  NotificationPreference,
  NotificationType,
  DeliveryChannel,
  UpdatePreferenceInput,
  IPreferenceRepository,
} from './notification.types';

// Default preferences for each notification type
interface DefaultPreferencesByChannel {
  websocket: boolean;
  email: boolean;
  push: boolean;
}

type DefaultPreferencesMap = Record<NotificationType, DefaultPreferencesByChannel>;

export class PreferenceService {
  constructor(private readonly repository: IPreferenceRepository) {}

  /**
   * Get all notification preferences for a user
   *
   * @param userId - User ID
   * @returns List of notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.repository.findByUserId(userId);
  }

  /**
   * Get preferences for a specific notification type
   *
   * @param userId - User ID
   * @param type - Notification type
   * @returns List of preferences for the type (one per channel)
   */
  async getPreferencesByType(
    userId: string,
    type: NotificationType
  ): Promise<NotificationPreference[]> {
    return this.repository.findByUserIdAndType(userId, type);
  }

  /**
   * Update or create a single preference
   *
   * @param userId - User ID
   * @param input - Preference update input
   * @returns Updated preference
   */
  async updatePreference(
    userId: string,
    input: UpdatePreferenceInput
  ): Promise<NotificationPreference> {
    return this.repository.upsert(userId, input);
  }

  /**
   * Update multiple preferences at once
   *
   * @param userId - User ID
   * @param inputs - Array of preference updates
   * @returns Array of updated preferences
   */
  async bulkUpdatePreferences(
    userId: string,
    inputs: UpdatePreferenceInput[]
  ): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];

    for (const input of inputs) {
      const result = await this.repository.upsert(userId, input);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete a specific preference
   *
   * @param userId - User ID
   * @param type - Notification type
   * @param channel - Delivery channel
   * @returns True if deleted, false if not found
   */
  async deletePreference(
    userId: string,
    type: NotificationType,
    channel: DeliveryChannel
  ): Promise<boolean> {
    return this.repository.delete(userId, type, channel);
  }

  /**
   * Check if a notification type is enabled for a specific channel
   *
   * @param userId - User ID
   * @param type - Notification type
   * @param channel - Delivery channel
   * @returns True if enabled (defaults to true if no preference exists)
   */
  async isNotificationEnabled(
    userId: string,
    type: NotificationType,
    channel: DeliveryChannel
  ): Promise<boolean> {
    const preferences = await this.repository.findByUserIdAndType(userId, type);

    const channelPref = preferences.find((p) => p.channel === channel);

    // Default to enabled if no preference exists
    if (!channelPref) {
      return true;
    }

    return channelPref.enabled;
  }

  /**
   * Check if current time is within user's quiet hours
   *
   * @param userId - User ID
   * @param type - Notification type
   * @param channel - Delivery channel
   * @param currentTime - Time to check (defaults to now)
   * @returns True if within quiet hours
   */
  async isWithinQuietHours(
    userId: string,
    type: NotificationType,
    channel: DeliveryChannel,
    currentTime: Date = new Date()
  ): Promise<boolean> {
    const preferences = await this.repository.findByUserIdAndType(userId, type);

    const channelPref = preferences.find((p) => p.channel === channel);

    if (!channelPref || !channelPref.quietHoursStart || !channelPref.quietHoursEnd) {
      return false;
    }

    const currentHour = currentTime.getUTCHours();
    const currentMinute = currentTime.getUTCMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const startParts = channelPref.quietHoursStart.split(':').map(Number);
    const endParts = channelPref.quietHoursEnd.split(':').map(Number);

    const startHour = startParts[0] ?? 0;
    const startMinute = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMinute = endParts[1] ?? 0;

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startTimeMinutes > endTimeMinutes) {
      // Quiet hours span midnight
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
    } else {
      // Normal range (e.g., 09:00 - 17:00)
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
    }
  }

  /**
   * Get default preferences for all notification types
   *
   * @returns Map of notification types to default channel settings
   */
  getDefaultPreferences(): DefaultPreferencesMap {
    return {
      mention: { websocket: true, email: true, push: true },
      like: { websocket: true, email: false, push: false },
      comment: { websocket: true, email: true, push: true },
      follow: { websocket: true, email: true, push: true },
      group_invite: { websocket: true, email: true, push: true },
      message: { websocket: true, email: true, push: true },
      system: { websocket: true, email: true, push: true },
    };
  }

  /**
   * Check if notification should be delivered via a specific channel
   * considering both enabled status and quiet hours
   *
   * @param userId - User ID
   * @param type - Notification type
   * @param channel - Delivery channel
   * @returns True if should deliver
   */
  async shouldDeliverViaChannel(
    userId: string,
    type: NotificationType,
    channel: DeliveryChannel
  ): Promise<boolean> {
    const isEnabled = await this.isNotificationEnabled(userId, type, channel);

    if (!isEnabled) {
      return false;
    }

    // WebSocket always delivers (for real-time), quiet hours only affect push/email
    if (channel === 'websocket') {
      return true;
    }

    const inQuietHours = await this.isWithinQuietHours(userId, type, channel);

    return !inQuietHours;
  }
}
