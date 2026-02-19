/**
 * Generic domain event interface for the messaging infrastructure.
 * The domain layer defines concrete event classes; this infrastructure
 * layer only depends on this minimal shape.
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredOn: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  toJSON(): Record<string, unknown>;
}

/**
 * Handler for a specific domain event type.
 */
export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * Dispatcher for in-process domain events.
 * Bounded contexts use this to publish and subscribe to domain events
 * within the same process boundary.
 */
export interface IEventDispatcher {
  /**
   * Dispatch a single domain event to all registered handlers.
   */
  dispatch(event: DomainEvent): Promise<void>;

  /**
   * Register a handler for a specific event type.
   */
  register(eventType: string, handler: IEventHandler): void;
}

/**
 * DI token for the IEventDispatcher interface.
 */
export const EVENT_DISPATCHER = Symbol('EVENT_DISPATCHER');
