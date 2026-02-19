import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * DI token for the Socket.IO Server instance.
 */
export const SOCKET_IO_SERVER = Symbol('SOCKET_IO_SERVER');

/**
 * Wrapper around the Socket.IO Server for emitting real-time events to clients.
 *
 * Provides convenience methods for emitting to individual users (by room),
 * arbitrary rooms, or all connected clients.
 */
@Injectable()
export class SocketIOEventEmitter {
  private readonly logger = new Logger(SocketIOEventEmitter.name);
  private server: Server | null = null;

  /**
   * Set the Socket.IO Server instance.
   * Called by the SocketIOGateway after the server is initialized.
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Emit an event to a specific user's room.
   * Users join the room `user:{userId}` upon WebSocket connection.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.ensureServer();
    this.server!.to(`user:${userId}`).emit(event, data);
    this.logger.debug(
      `Emitted "${event}" to user "${userId}"`,
    );
  }

  /**
   * Emit an event to all clients in a named room.
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    this.ensureServer();
    this.server!.to(room).emit(event, data);
    this.logger.debug(`Emitted "${event}" to room "${room}"`);
  }

  /**
   * Emit an event to all connected clients.
   */
  emitToAll(event: string, data: unknown): void {
    this.ensureServer();
    this.server!.emit(event, data);
    this.logger.debug(`Emitted "${event}" to all clients`);
  }

  private ensureServer(): void {
    if (!this.server) {
      throw new Error(
        'Socket.IO Server is not initialized. Ensure the SocketIOGateway has started.',
      );
    }
  }
}
