/**
 * NotificationService
 * Core service for notification CRUD operations
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import {
  Notification,
  CreateNotificationInput,
  INotificationRepository,
  IPreferenceRepository,
  PaginatedResponse,
  PaginationParams,
  NotificationQueryFilters,
  MarkAsReadResult,
  MarkAllAsReadResult,
  DeduplicationKey,
} from './notification.types';

// Default pagination values
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// Deduplication window in milliseconds (5 minutes)
const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;

export class NotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly preferenceRepository: IPreferenceRepository
  ) {}

  /**
   * Create a new notification with preference filtering and deduplication
   *
   * @param input - Notification creation input
   * @returns Created notification or null if filtered/deduplicated
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification | null> {
    // Step 1: Check user preferences for this notification type
    const preferences = await this.preferenceRepository.findByUserIdAndType(
      input.recipientId,
      input.type
    );

    // If user has explicitly disabled this notification type, skip
    const hasDisabledPreference = preferences.some(pref => pref.enabled === false);
    if (hasDisabledPreference) {
      return null;
    }

    // Step 2: Check for duplicate notifications within the time window
    const deduplicationKey: DeduplicationKey = {
      recipientId: input.recipientId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
    };

    const existingNotification = await this.notificationRepository.findDuplicate(
      deduplicationKey,
      DEDUPLICATION_WINDOW_MS
    );

    if (existingNotification) {
      // Return existing notification instead of creating duplicate
      return existingNotification;
    }

    // Step 3: Create the notification with default priority if not specified
    const notificationInput: CreateNotificationInput = {
      ...input,
      priority: input.priority ?? 1, // Default to normal priority
    };

    return this.notificationRepository.create(notificationInput);
  }

  /**
   * Get paginated notifications for a user
   *
   * @param userId - User ID to fetch notifications for
   * @param filters - Optional query filters
   * @param pagination - Optional pagination parameters
   * @returns Paginated list of notifications
   */
  async getNotifications(
    userId: string,
    filters: NotificationQueryFilters = {},
    pagination: PaginationParams = { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT }
  ): Promise<PaginatedResponse<Notification>> {
    return this.notificationRepository.findByUserId(userId, filters, pagination);
  }

  /**
   * Mark a single notification as read
   *
   * @param notificationId - ID of notification to mark as read
   * @param userId - ID of user making the request (for authorization)
   * @returns Mark as read result
   * @throws Error if notification not found or user unauthorized
   */
  async markAsRead(notificationId: string, userId: string): Promise<MarkAsReadResult> {
    // Verify notification exists and user owns it
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new Error('Unauthorized');
    }

    return this.notificationRepository.markAsRead(notificationId);
  }

  /**
   * Mark all unread notifications for a user as read
   *
   * @param userId - User ID
   * @returns Mark all as read result with count
   */
  async markAllAsRead(userId: string): Promise<MarkAllAsReadResult> {
    return this.notificationRepository.markAllAsRead(userId);
  }

  /**
   * Get unread notification count for a user
   *
   * @param userId - User ID
   * @returns Unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Delete a notification
   *
   * @param notificationId - ID of notification to delete
   * @param userId - ID of user making the request
   * @returns True if deleted
   * @throws Error if notification not found or user unauthorized
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new Error('Unauthorized');
    }

    return this.notificationRepository.delete(notificationId);
  }
}
