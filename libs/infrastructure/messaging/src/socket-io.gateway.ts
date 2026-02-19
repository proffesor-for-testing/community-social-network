import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SocketIOEventEmitter } from './socket-io-event-emitter';

/**
 * Payload for JWT verification.
 * The actual JWT verification logic should be injected or configured
 * at the application layer; this interface defines the expected shape.
 */
export interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Function type for verifying JWT tokens.
 * Implementations should throw on invalid/expired tokens.
 */
export type JwtVerifyFn = (token: string) => JwtPayload | Promise<JwtPayload>;

/**
 * DI token for the JWT verification function.
 */
export const JWT_VERIFY_FN = Symbol('JWT_VERIFY_FN');

/**
 * WebSocket gateway for real-time event delivery.
 *
 * Authenticates clients via JWT on connection, automatically joins
 * each user to their personal room (`user:{userId}`), and supports
 * dynamic room subscription/unsubscription.
 */
@WebSocketGateway({
  cors: true,
  namespace: '/events',
})
export class SocketIOGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketIOGateway.name);

  @WebSocketServer()
  server!: Server;

  private jwtVerifyFn: JwtVerifyFn | null = null;

  constructor(private readonly eventEmitter: SocketIOEventEmitter) {}

  /**
   * Set the JWT verification function.
   * Must be called during module initialization.
   */
  setJwtVerifyFn(fn: JwtVerifyFn): void {
    this.jwtVerifyFn = fn;
  }

  afterInit(server: Server): void {
    this.eventEmitter.setServer(server);
    this.logger.log('Socket.IO Gateway initialized on namespace "/events"');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.['token'] ??
        client.handshake.headers?.['authorization']?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      if (!this.jwtVerifyFn) {
        throw new Error('JWT verify function not configured');
      }

      const payload = await this.jwtVerifyFn(token);
      const userId = payload.sub;

      // Attach user ID to socket data for later use.
      (client.data as Record<string, unknown>)['userId'] = userId;

      // Join the user's personal room.
      await client.join(`user:${userId}`);

      this.logger.log(
        `Client connected: ${client.id} (user: ${userId})`,
      );
    } catch (error) {
      this.logger.warn(
        `Connection rejected for client ${client.id}: ${error instanceof Error ? error.message : error}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as Record<string, unknown>)['userId'];
    this.logger.log(
      `Client disconnected: ${client.id}${userId ? ` (user: ${userId})` : ''}`,
    );
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    client: Socket,
    room: string,
  ): Promise<{ event: string; data: { success: boolean } }> {
    if (!room || typeof room !== 'string') {
      return { event: 'join-room', data: { success: false } };
    }

    await client.join(room);
    this.logger.debug(`Client ${client.id} joined room "${room}"`);
    return { event: 'join-room', data: { success: true } };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    client: Socket,
    room: string,
  ): Promise<{ event: string; data: { success: boolean } }> {
    if (!room || typeof room !== 'string') {
      return { event: 'leave-room', data: { success: false } };
    }

    await client.leave(room);
    this.logger.debug(`Client ${client.id} left room "${room}"`);
    return { event: 'leave-room', data: { success: true } };
  }
}
