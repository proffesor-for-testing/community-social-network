/**
 * WebSocketService
 * Real-time notification delivery via Socket.IO
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import { NotificationWithActor } from './notification.types';

// Type definitions for Socket.IO compatibility
interface Socket {
  id: string;
  data: { userId?: string };
  join(room: string): void;
  leave(room: string): void;
  emit(event: string, data: unknown): void;
  disconnect(close?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

interface Server {
  to(room: string): {
    emit(event: string, data: unknown): void;
  };
  in(room: string): {
    emit(event: string, data: unknown): void;
    fetchSockets(): Promise<Socket[]>;
  };
  emit(event: string, data: unknown): void;
}

// Room pattern prefixes
const ROOM_PREFIX = {
  USER: 'user:',
  GROUP: 'group:',
  POST: 'post:',
  DM: 'dm:',
} as const;

export class WebSocketService {
  // Expose types for test mocking
  io: Server;
  socket: Socket;

  constructor(io: Server) {
    this.io = io;
    this.socket = null as unknown as Socket;
  }

  /**
   * Send notification to a specific user
   *
   * @param userId - Target user ID
   * @param notification - Notification with actor details
   */
  async sendToUser(userId: string, notification: NotificationWithActor): Promise<void> {
    const room = this.getUserRoom(userId);
    this.io.to(room).emit('notification:new', notification);
  }

  /**
   * Send notification read confirmation to user
   *
   * @param userId - User ID
   * @param notificationId - ID of read notification
   * @param readAt - Timestamp when marked as read
   */
  async sendReadNotification(
    userId: string,
    notificationId: string,
    readAt: Date
  ): Promise<void> {
    const room = this.getUserRoom(userId);
    this.io.to(room).emit('notification:read', { notificationId, readAt });
  }

  /**
   * Send unread count update to user
   *
   * @param userId - User ID
   * @param unreadCount - Current unread count
   */
  async sendUnreadCount(userId: string, unreadCount: number): Promise<void> {
    const room = this.getUserRoom(userId);
    this.io.to(room).emit('notification:count', { unreadCount });
  }

  /**
   * Make a socket join its user's personal room
   *
   * @param socket - Socket.IO socket instance
   * @param userId - User ID to associate with socket
   */
  async joinUserRoom(socket: Socket, userId: string): Promise<void> {
    socket.data.userId = userId;
    socket.join(this.getUserRoom(userId));
  }

  /**
   * Make a socket leave a user room
   *
   * @param socket - Socket.IO socket instance
   * @param userId - User ID room to leave
   */
  async leaveUserRoom(socket: Socket, userId: string): Promise<void> {
    socket.leave(this.getUserRoom(userId));
  }

  /**
   * Broadcast notification to a specific room
   *
   * @param room - Room name (e.g., 'group:123', 'post:456')
   * @param notification - Notification to broadcast
   */
  async broadcastToRoom(room: string, notification: NotificationWithActor): Promise<void> {
    this.io.to(room).emit('notification:new', notification);
  }

  /**
   * Check if a user has any active connections
   *
   * @param userId - User ID to check
   * @returns True if user has at least one active connection
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const room = this.getUserRoom(userId);
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.length > 0;
  }

  /**
   * Get number of active connections for a user
   *
   * @param userId - User ID
   * @returns Number of active socket connections
   */
  async getUserConnectionCount(userId: string): Promise<number> {
    const room = this.getUserRoom(userId);
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * Disconnect all sockets for a user
   *
   * @param userId - User ID to disconnect
   */
  async disconnectUser(userId: string): Promise<void> {
    const room = this.getUserRoom(userId);
    const sockets = await this.io.in(room).fetchSockets();

    for (const socket of sockets) {
      socket.disconnect(true);
    }
  }

  /**
   * Get user room name from user ID
   *
   * @param userId - User ID
   * @returns Room name string
   */
  private getUserRoom(userId: string): string {
    return `${ROOM_PREFIX.USER}${userId}`;
  }

  /**
   * Get group room name from group ID
   *
   * @param groupId - Group ID
   * @returns Room name string
   */
  getGroupRoom(groupId: string): string {
    return `${ROOM_PREFIX.GROUP}${groupId}`;
  }

  /**
   * Get post room name from post ID
   *
   * @param postId - Post ID
   * @returns Room name string
   */
  getPostRoom(postId: string): string {
    return `${ROOM_PREFIX.POST}${postId}`;
  }

  /**
   * Get direct message room name from conversation ID
   *
   * @param conversationId - Conversation ID
   * @returns Room name string
   */
  getDmRoom(conversationId: string): string {
    return `${ROOM_PREFIX.DM}${conversationId}`;
  }
}
