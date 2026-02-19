/**
 * Integration event for cross-context asynchronous communication via message queues.
 */
export interface IntegrationEvent {
  /** Unique event identifier (UUID v4). */
  readonly id: string;
  /** Event type following the naming convention: context.aggregate_verb */
  readonly type: string;
  /** Timestamp when the event occurred. */
  readonly occurredOn: Date;
  /** Event payload containing business data. */
  readonly payload: Record<string, unknown>;
  /** Event metadata for tracing and versioning. */
  readonly metadata: IntegrationEventMetadata;
}

export interface IntegrationEventMetadata {
  /** Correlation ID for tracing a chain of related events. */
  correlationId?: string;
  /** ID of the event that caused this event to be raised. */
  causationId?: string;
  /** Schema version of the event payload. */
  version: number;
}

/**
 * Publisher for integration events that cross bounded context boundaries.
 * Implementations typically use a message queue (e.g., Bull/BullMQ + Redis).
 */
export interface IIntegrationEventPublisher {
  /**
   * Publish an integration event to a named queue.
   * @param queueName - The target queue name.
   * @param event - The integration event to publish.
   */
  publish(queueName: string, event: IntegrationEvent): Promise<void>;
}

/**
 * DI token for the IIntegrationEventPublisher interface.
 */
export const INTEGRATION_EVENT_PUBLISHER = Symbol(
  'INTEGRATION_EVENT_PUBLISHER',
);
