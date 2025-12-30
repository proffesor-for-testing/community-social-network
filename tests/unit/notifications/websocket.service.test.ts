/**
 * WebSocketService Unit Tests
 * TDD London School - Outside-In with Mocks
 * SPARC Phase 4 - M7 Notifications Module
 */

import { WebSocketService } from '../../../src/notifications/websocket.service';
import {
  NotificationWithActor,
  NotificationType,
} from '../../../src/notifications/notification.types';

// Mock Socket.IO server and socket
interface MockSocket {
  id: string;
  data: { userId?: string };
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  on: jest.Mock;
}

interface MockServer {
  to: jest.Mock;
  emit: jest.Mock;
  in: jest.Mock;
}

const createMockSocket = (overrides: Partial<MockSocket> = {}): MockSocket => ({
  id: 'socket-123',
  data: { userId: 'user-456' },
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  ...overrides,
});

const createMockServer = (): MockServer => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({
    emit: mockEmit,
  });
  const mockIn = jest.fn().mockReturnValue({
    emit: mockEmit,
    fetchSockets: jest.fn().mockResolvedValue([]),
  });

  return {
    to: mockTo,
    emit: mockEmit,
    in: mockIn,
  };
};

const createMockNotificationWithActor = (
  overrides: Partial<NotificationWithActor> = {}
): NotificationWithActor => ({
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
  actor: {
    id: 'user-789',
    username: 'john',
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  ...overrides,
});

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = createMockServer();
    service = new WebSocketService(mockServer as unknown as WebSocketService['io']);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendToUser', () => {
    it('should emit notification to user room', async () => {
      // Arrange
      const userId = 'user-456';
      const notification = createMockNotificationWithActor();

      // Act
      await service.sendToUser(userId, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockServer.to(`user:${userId}`).emit).toHaveBeenCalledWith(
        'notification:new',
        notification
      );
    });

    it('should send to correct room pattern for user', async () => {
      // Arrange
      const userId = 'user-123';
      const notification = createMockNotificationWithActor({ recipientId: userId });

      // Act
      await service.sendToUser(userId, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
    });
  });

  describe('sendReadNotification', () => {
    it('should emit notification:read event to user', async () => {
      // Arrange
      const userId = 'user-456';
      const notificationId = 'notif-123';
      const readAt = new Date('2025-12-30T12:00:00Z');

      // Act
      await service.sendReadNotification(userId, notificationId, readAt);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockServer.to(`user:${userId}`).emit).toHaveBeenCalledWith(
        'notification:read',
        { notificationId, readAt }
      );
    });
  });

  describe('sendUnreadCount', () => {
    it('should emit notification:count event to user', async () => {
      // Arrange
      const userId = 'user-456';
      const unreadCount = 10;

      // Act
      await service.sendUnreadCount(userId, unreadCount);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockServer.to(`user:${userId}`).emit).toHaveBeenCalledWith(
        'notification:count',
        { unreadCount }
      );
    });
  });

  describe('joinUserRoom', () => {
    it('should make socket join user room', async () => {
      // Arrange
      const socket = createMockSocket();
      const userId = 'user-456';

      // Act
      await service.joinUserRoom(socket as unknown as WebSocketService['socket'], userId);

      // Assert
      expect(socket.join).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('should store userId in socket data', async () => {
      // Arrange
      const socket = createMockSocket({ data: {} });
      const userId = 'user-456';

      // Act
      await service.joinUserRoom(socket as unknown as WebSocketService['socket'], userId);

      // Assert
      expect(socket.data.userId).toBe(userId);
    });
  });

  describe('leaveUserRoom', () => {
    it('should make socket leave user room', async () => {
      // Arrange
      const socket = createMockSocket();
      const userId = 'user-456';

      // Act
      await service.leaveUserRoom(socket as unknown as WebSocketService['socket'], userId);

      // Assert
      expect(socket.leave).toHaveBeenCalledWith(`user:${userId}`);
    });
  });

  describe('broadcastToRoom', () => {
    it('should broadcast notification to specified room', async () => {
      // Arrange
      const room = 'group:group-123';
      const notification = createMockNotificationWithActor({ type: 'group_invite' });

      // Act
      await service.broadcastToRoom(room, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(room);
      expect(mockServer.to(room).emit).toHaveBeenCalledWith(
        'notification:new',
        notification
      );
    });

    it('should support post room broadcasts', async () => {
      // Arrange
      const room = 'post:post-123';
      const notification = createMockNotificationWithActor({ type: 'comment' });

      // Act
      await service.broadcastToRoom(room, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(room);
    });
  });

  describe('isUserOnline', () => {
    it('should return true when user has active connections', async () => {
      // Arrange
      const userId = 'user-456';
      const mockSockets = [createMockSocket()];
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue(mockSockets),
      });

      // Act
      const isOnline = await service.isUserOnline(userId);

      // Assert
      expect(mockServer.in).toHaveBeenCalledWith(`user:${userId}`);
      expect(isOnline).toBe(true);
    });

    it('should return false when user has no active connections', async () => {
      // Arrange
      const userId = 'user-456';
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      });

      // Act
      const isOnline = await service.isUserOnline(userId);

      // Assert
      expect(isOnline).toBe(false);
    });
  });

  describe('getUserConnectionCount', () => {
    it('should return number of active connections for user', async () => {
      // Arrange
      const userId = 'user-456';
      const mockSockets = [
        createMockSocket({ id: 'socket-1' }),
        createMockSocket({ id: 'socket-2' }),
        createMockSocket({ id: 'socket-3' }),
      ];
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue(mockSockets),
      });

      // Act
      const count = await service.getUserConnectionCount(userId);

      // Assert
      expect(count).toBe(3);
    });

    it('should return 0 when user has no connections', async () => {
      // Arrange
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      });

      // Act
      const count = await service.getUserConnectionCount('user-456');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('disconnectUser', () => {
    it('should disconnect all sockets for a user', async () => {
      // Arrange
      const userId = 'user-456';
      const mockSocket1 = createMockSocket({ id: 'socket-1' });
      const mockSocket2 = createMockSocket({ id: 'socket-2' });
      mockServer.in = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([mockSocket1, mockSocket2]),
      });

      // Act
      await service.disconnectUser(userId);

      // Assert
      expect(mockSocket1.disconnect).toHaveBeenCalledWith(true);
      expect(mockSocket2.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('event emission for different notification types', () => {
    const notificationTypes: NotificationType[] = [
      'mention',
      'like',
      'comment',
      'follow',
      'group_invite',
      'message',
    ];

    notificationTypes.forEach((type) => {
      it(`should emit ${type} notification correctly`, async () => {
        // Arrange
        const userId = 'user-456';
        const notification = createMockNotificationWithActor({ type });

        // Act
        await service.sendToUser(userId, notification);

        // Assert
        expect(mockServer.to(`user:${userId}`).emit).toHaveBeenCalledWith(
          'notification:new',
          expect.objectContaining({ type })
        );
      });
    });
  });

  describe('room patterns', () => {
    it('should use correct pattern for user rooms', async () => {
      // Arrange
      const userId = 'abc-123-def';

      // Act
      await service.sendUnreadCount(userId, 5);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('user:abc-123-def');
    });

    it('should use correct pattern for group rooms', async () => {
      // Arrange
      const groupId = 'group-123';
      const notification = createMockNotificationWithActor({ type: 'group_invite' });

      // Act
      await service.broadcastToRoom(`group:${groupId}`, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('group:group-123');
    });

    it('should use correct pattern for post rooms', async () => {
      // Arrange
      const postId = 'post-123';
      const notification = createMockNotificationWithActor({ type: 'comment' });

      // Act
      await service.broadcastToRoom(`post:${postId}`, notification);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('post:post-123');
    });
  });
});
