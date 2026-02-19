// Event Dispatcher (in-process domain events)
export {
  DomainEvent,
  IEventDispatcher,
  IEventHandler,
  EVENT_DISPATCHER,
} from './event-dispatcher.interface';
export { InProcessEventDispatcher } from './in-process-event-dispatcher';

// Integration Event Publisher (cross-context via Bull queues)
export {
  IntegrationEvent,
  IntegrationEventMetadata,
  IIntegrationEventPublisher,
  INTEGRATION_EVENT_PUBLISHER,
} from './integration-event-publisher.interface';
export { BullQueueEventPublisher, BullRedisConfig } from './bull-queue-event-publisher';

// Bull configuration
export {
  BullRootModuleConfig,
  DEFAULT_QUEUE_OPTIONS,
  getRedisOptions,
} from './bull.config';

// Dead Letter Queue
export {
  DeadLetterQueueService,
  DLQEntry,
} from './dead-letter-queue';

// Idempotency
export { IdempotencyStore } from './idempotency-store';

// Socket.IO (real-time events)
export {
  SocketIOEventEmitter,
  SOCKET_IO_SERVER,
} from './socket-io-event-emitter';
export {
  SocketIOGateway,
  JwtPayload,
  JwtVerifyFn,
  JWT_VERIFY_FN,
} from './socket-io.gateway';

// Module
export { MessagingModule } from './messaging.module';
