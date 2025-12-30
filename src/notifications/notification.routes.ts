/**
 * NotificationRoutes
 * Express router for notification endpoints
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import { Router } from 'express';
import { NotificationController } from './notification.controller';

/**
 * Create notification routes
 *
 * @param controller - NotificationController instance
 * @param authMiddleware - Authentication middleware
 * @returns Express router
 */
export function createNotificationRoutes(
  controller: NotificationController,
  authMiddleware: (req: any, res: any, next: any) => void
): Router {
  const router = Router();

  /**
   * @route GET /api/notifications
   * @desc Get paginated list of notifications
   * @access Private
   * @query page - Page number (default: 1)
   * @query limit - Items per page (default: 20, max: 100)
   * @query unreadOnly - Filter only unread notifications
   */
  router.get(
    '/',
    authMiddleware,
    (req, res) => controller.getNotifications(req, res)
  );

  /**
   * @route GET /api/notifications/unread-count
   * @desc Get unread notification count
   * @access Private
   */
  router.get(
    '/unread-count',
    authMiddleware,
    (req, res) => controller.getUnreadCount(req, res)
  );

  /**
   * @route POST /api/notifications/read-all
   * @desc Mark all notifications as read
   * @access Private
   */
  router.post(
    '/read-all',
    authMiddleware,
    (req, res) => controller.markAllAsRead(req, res)
  );

  /**
   * @route GET /api/notifications/preferences
   * @desc Get notification preferences
   * @access Private
   */
  router.get(
    '/preferences',
    authMiddleware,
    (req, res) => controller.getPreferences(req, res)
  );

  /**
   * @route PUT /api/notifications/preferences
   * @desc Update notification preferences
   * @access Private
   * @body preferences - Array of preference updates
   */
  router.put(
    '/preferences',
    authMiddleware,
    (req, res) => controller.updatePreferences(req, res)
  );

  /**
   * @route PATCH /api/notifications/:id/read
   * @desc Mark a single notification as read
   * @access Private
   */
  router.patch(
    '/:id/read',
    authMiddleware,
    (req, res) => controller.markAsRead(req, res)
  );

  /**
   * @route DELETE /api/notifications/:id
   * @desc Delete a notification
   * @access Private
   */
  router.delete(
    '/:id',
    authMiddleware,
    (req, res) => controller.deleteNotification(req, res)
  );

  return router;
}

/**
 * Notification API endpoints:
 *
 * GET    /api/notifications           - List notifications (paginated)
 * GET    /api/notifications/unread-count - Get unread count
 * POST   /api/notifications/read-all  - Mark all as read
 * GET    /api/notifications/preferences - Get preferences
 * PUT    /api/notifications/preferences - Update preferences
 * PATCH  /api/notifications/:id/read  - Mark one as read
 * DELETE /api/notifications/:id       - Delete notification
 */
