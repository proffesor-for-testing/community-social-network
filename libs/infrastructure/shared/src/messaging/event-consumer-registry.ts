import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export interface EventConsumerRegistration {
  eventType: string;
  consumerClass: new (...args: unknown[]) => EventConsumerHandler;
}

export interface EventConsumerHandler {
  handle(event: unknown): Promise<void>;
}

/**
 * Registry for integration event consumers.
 * Allows bounded contexts to register handlers for cross-context events.
 */
@Injectable()
export class EventConsumerRegistry implements OnModuleInit {
  private readonly logger = new Logger(EventConsumerRegistry.name);
  private readonly registrations: EventConsumerRegistration[] = [];
  private readonly handlers = new Map<string, EventConsumerHandler[]>();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Register a consumer class for a specific event type.
   * Call during module initialization.
   */
  register(eventType: string, consumerClass: new (...args: unknown[]) => EventConsumerHandler): void {
    this.registrations.push({ eventType, consumerClass });
  }

  async onModuleInit(): Promise<void> {
    for (const { eventType, consumerClass } of this.registrations) {
      try {
        const instance = this.moduleRef.get(consumerClass, { strict: false });
        const existing = this.handlers.get(eventType) ?? [];
        existing.push(instance);
        this.handlers.set(eventType, existing);
        this.logger.log(`Registered consumer ${consumerClass.name} for event ${eventType}`);
      } catch (error) {
        this.logger.error(
          `Failed to resolve consumer ${consumerClass.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Dispatch an integration event to all registered consumers.
   */
  async dispatch(eventType: string, event: unknown): Promise<void> {
    const consumers = this.handlers.get(eventType) ?? [];

    if (consumers.length === 0) {
      this.logger.debug(`No consumers registered for event ${eventType}`);
      return;
    }

    await Promise.allSettled(
      consumers.map((consumer) => consumer.handle(event)),
    );
  }

  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
