/**
 * NotificationController
 * HTTP handlers for notification endpoints
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import { Response } from 'express';
import { NotificationService } from './notification.service';
import { PreferenceService } from './preference.service';
import { WebSocketService } from './websocket.service';
import { UpdatePreferenceInput } from './notification.types';

// Custom request interface without extending Express Request to avoid type conflicts
interface AuthenticatedRequest {
  params: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: Record<string, unknown>;
  user?: { id: string };
}

export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: PreferenceService,
    private readonly webSocketService: WebSocketService
  ) {}

  /**
   * GET /api/notifications
   * Get paginated list of notifications for authenticated user
   */
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const filters = unreadOnly ? { unreadOnly: true } : {};

      const result = await this.notificationService.getNotifications(
        req.user.id,
        filters,
        { page, limit }
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a single notification as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const notificationId = req.params.id as string;

      const result = await this.notificationService.markAsRead(
        notificationId,
        req.user.id
      );

      // Notify via WebSocket
      await this.webSocketService.sendReadNotification(
        req.user.id,
        notificationId,
        result.readAt
      );

      // Update unread count
      const unreadCount = await this.notificationService.getUnreadCount(req.user.id);
      await this.webSocketService.sendUnreadCount(req.user.id, unreadCount);

      res.status(200).json({
        success: true,
        notificationId: result.notificationId,
        readAt: result.readAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';

      if (message === 'Notification not found') {
        res.status(404).json({ success: false, error: message });
        return;
      }

      if (message === 'Unauthorized') {
        res.status(403).json({ success: false, error: message });
        return;
      }

      res.status(500).json({ success: false, error: message });
    }
  }

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read for authenticated user
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.notificationService.markAllAsRead(req.user.id);

      // Notify via WebSocket that count is now 0
      await this.webSocketService.sendUnreadCount(req.user.id, 0);

      res.status(200).json({
        success: true,
        count: result.count,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count for authenticated user
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const unreadCount = await this.notificationService.getUnreadCount(req.user.id);

      res.status(200).json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/notifications/preferences
   * Get notification preferences for authenticated user
   */
  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const preferences = await this.preferenceService.getUserPreferences(req.user.id);

      res.status(200).json({
        success: true,
        preferences,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * PUT /api/notifications/preferences
   * Update notification preferences for authenticated user
   */
  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { preferences } = req.body as { preferences?: UpdatePreferenceInput[] };

      if (!preferences || !Array.isArray(preferences)) {
        res.status(400).json({
          success: false,
          error: 'Preferences array required',
        });
        return;
      }

      const updatedPreferences = await this.preferenceService.bulkUpdatePreferences(
        req.user.id,
        preferences
      );

      res.status(200).json({
        success: true,
        preferences: updatedPreferences,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.notificationService.deleteNotification(req.params.id as string, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';

      if (message === 'Notification not found') {
        res.status(404).json({ success: false, error: message });
        return;
      }

      if (message === 'Unauthorized') {
        res.status(403).json({ success: false, error: message });
        return;
      }

      res.status(500).json({ success: false, error: message });
    }
  }
}
