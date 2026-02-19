import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  IEventDispatcher,
  IEventHandler,
} from './event-dispatcher.interface';

/**
 * In-process event dispatcher for same-context domain events.
 *
 * Provides at-most-once delivery within a single process.
 * Individual handler failures are caught and logged so that
 * one failing handler does not prevent others from executing.
 */
@Injectable()
export class InProcessEventDispatcher implements IEventDispatcher {
  private readonly logger = new Logger(InProcessEventDispatcher.name);
  private readonly handlers = new Map<string, IEventHandler[]>();

  /**
   * Register a handler for a given event type.
   * Multiple handlers can be registered for the same event type.
   */
  register(eventType: string, handler: IEventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
    this.logger.log(
      `Registered handler for event type "${eventType}" (${existing.length} total)`,
    );
  }

  /**
   * Dispatch a domain event to all registered handlers.
   * Each handler is executed concurrently via Promise.allSettled
   * so that one failure does not block the others.
   */
  async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);

    if (!handlers || handlers.length === 0) {
      this.logger.debug(
        `No handlers registered for event type "${event.eventType}"`,
      );
      return;
    }

    this.logger.debug(
      `Dispatching event "${event.eventType}" (id: ${event.eventId}) to ${handlers.length} handler(s)`,
    );

    const results = await Promise.allSettled(
      handlers.map((handler) => handler.handle(event)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Handler failed for event "${event.eventType}" (id: ${event.eventId}): ${result.reason}`,
          result.reason instanceof Error ? result.reason.stack : undefined,
        );
      }
    }
  }
}
