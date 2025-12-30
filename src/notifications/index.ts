/**
 * Notifications Module - M7
 * Real-time notification system with WebSocket support
 * SPARC Phase 4 - TDD Implementation
 */

// Types and interfaces
export * from './notification.types';

// Services
export { NotificationService } from './notification.service';
export { PreferenceService } from './preference.service';
export { WebSocketService } from './websocket.service';
export { NotificationQueue } from './notification.queue';

// Controller and routes
export { NotificationController } from './notification.controller';
export { createNotificationRoutes } from './notification.routes';
