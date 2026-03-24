import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IEventDispatcher,
  IEventHandler,
  EVENT_DISPATCHER,
} from '@csn/infra-messaging';

/**
 * Maps domain event types to handler class references.
 * Used during module initialization to auto-wire in-process handlers.
 */
export interface EventHandlerBinding {
  /** The domain event type string (e.g. 'PublicationCreated'). */
  eventType: string;
  /** The injectable handler class. */
  handlerClass: new (...args: unknown[]) => IEventHandler;
}

/**
 * Central registry that discovers and wires domain event handlers
 * from all bounded context modules.
 *
 * During module initialization, it resolves each registered handler
 * class from the NestJS DI container and registers it with the
 * InProcessEventDispatcher for same-context event delivery.
 *
 * Cross-context events are handled separately through Bull queues
 * (see integration-event-routing.ts).
 */
@Injectable()
export class EventHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(EventHandlerRegistry.name);
  private readonly bindings: EventHandlerBinding[] = [];

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Register a handler class for a specific event type.
   * Call this during module configuration (e.g., in a module's onModuleInit).
   */
  registerBinding(eventType: string, handlerClass: new (...args: unknown[]) => IEventHandler): void {
    this.bindings.push({ eventType, handlerClass });
  }

  /**
   * Bulk-register multiple bindings at once.
   */
  registerBindings(bindings: EventHandlerBinding[]): void {
    this.bindings.push(...bindings);
  }

  /**
   * On module init, resolve each handler from DI and register it
   * with the in-process event dispatcher.
   */
  async onModuleInit(): Promise<void> {
    let dispatcher: IEventDispatcher;
    try {
      dispatcher = this.moduleRef.get(EVENT_DISPATCHER, { strict: false });
    } catch {
      this.logger.warn(
        'EVENT_DISPATCHER not found in DI container. Skipping handler registration.',
      );
      return;
    }

    let registered = 0;

    for (const binding of this.bindings) {
      try {
        const handler = this.moduleRef.get(binding.handlerClass, {
          strict: false,
        });
        dispatcher.register(binding.eventType, handler);
        registered++;
        this.logger.log(
          `Registered handler ${binding.handlerClass.name} for event "${binding.eventType}"`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to resolve handler ${binding.handlerClass.name} for event "${binding.eventType}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Event handler registry initialized: ${registered}/${this.bindings.length} handlers registered`,
    );
  }

  /**
   * Returns the list of all registered bindings (useful for diagnostics).
   */
  getBindings(): ReadonlyArray<EventHandlerBinding> {
    return [...this.bindings];
  }
}
