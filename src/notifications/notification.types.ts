/**
 * Notification Types and Interfaces
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

// Notification types as defined in architecture
export type NotificationType =
  | 'mention'
  | 'like'
  | 'comment'
  | 'follow'
  | 'group_invite'
  | 'message'
  | 'system';

// Delivery channels
export type DeliveryChannel = 'websocket' | 'email' | 'push';

// Notification frequency preferences
export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

// Priority levels (0=low, 1=normal, 2=high)
export type NotificationPriority = 0 | 1 | 2;

// Entity types for polymorphic references
export type EntityType = 'Post' | 'Comment' | 'User' | 'Group' | 'Message';

/**
 * Core Notification entity
 */
export interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  entityId?: string;
  entityType: EntityType;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  priority: NotificationPriority;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  entityId?: string;
  entityType: EntityType;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  expiresAt?: Date;
}

/**
 * Notification with actor details for display
 */
export interface NotificationWithActor extends Notification {
  actor: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

/**
 * User notification preferences
 */
export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  channel: DeliveryChannel;
  enabled: boolean;
  frequency: NotificationFrequency;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for updating preferences
 */
export interface UpdatePreferenceInput {
  notificationType: NotificationType;
  channel: DeliveryChannel;
  enabled?: boolean;
  frequency?: NotificationFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Notification query filters
 */
export interface NotificationQueryFilters {
  unreadOnly?: boolean;
  type?: NotificationType;
  since?: Date;
}

/**
 * Mark as read result
 */
export interface MarkAsReadResult {
  success: boolean;
  notificationId: string;
  readAt: Date;
}

/**
 * Mark all as read result
 */
export interface MarkAllAsReadResult {
  success: boolean;
  count: number;
  readAt: Date;
}

/**
 * WebSocket notification events
 */
export interface NotificationEvents {
  'notification:new': (notification: NotificationWithActor) => void;
  'notification:read': (data: { notificationId: string; readAt: Date }) => void;
  'notification:count': (data: { unreadCount: number }) => void;
}

/**
 * WebSocket client events
 */
export interface NotificationClientEvents {
  'notification:read': (notificationId: string) => void;
  'notification:readAll': () => void;
  'notifications:sync': (params: { since: Date }) => void;
}

/**
 * Notification queue job data
 */
export interface NotificationJobData {
  notificationId: string;
  recipientId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
}

/**
 * Delivery result from queue processing
 */
export interface DeliveryResult {
  notificationId: string;
  channel: DeliveryChannel;
  delivered: boolean;
  deliveredAt?: Date;
  error?: string;
}

/**
 * Deduplication key for preventing duplicate notifications
 */
export interface DeduplicationKey {
  recipientId: string;
  actorId: string;
  entityType: EntityType;
  entityId?: string;
  type: NotificationType;
}

/**
 * Repository interface for data access
 */
export interface INotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    filters?: NotificationQueryFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Notification>>;
  markAsRead(id: string): Promise<MarkAsReadResult>;
  markAllAsRead(userId: string): Promise<MarkAllAsReadResult>;
  getUnreadCount(userId: string): Promise<number>;
  delete(id: string): Promise<boolean>;
  findDuplicate(key: DeduplicationKey, windowMs: number): Promise<Notification | null>;
}

/**
 * Preference repository interface
 */
export interface IPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreference[]>;
  findByUserIdAndType(
    userId: string,
    type: NotificationType
  ): Promise<NotificationPreference[]>;
  upsert(
    userId: string,
    input: UpdatePreferenceInput
  ): Promise<NotificationPreference>;
  delete(userId: string, type: NotificationType, channel: DeliveryChannel): Promise<boolean>;
}
