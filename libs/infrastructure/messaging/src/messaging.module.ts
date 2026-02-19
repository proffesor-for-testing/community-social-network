import { Module } from '@nestjs/common';
import { BullRootModuleConfig, getRedisOptions } from './bull.config';
import { BullQueueEventPublisher, BullRedisConfig } from './bull-queue-event-publisher';
import { DeadLetterQueueService } from './dead-letter-queue';
import {
  EVENT_DISPATCHER,
} from './event-dispatcher.interface';
import { IdempotencyStore } from './idempotency-store';
import { InProcessEventDispatcher } from './in-process-event-dispatcher';
import {
  INTEGRATION_EVENT_PUBLISHER,
} from './integration-event-publisher.interface';
import { SocketIOEventEmitter } from './socket-io-event-emitter';
import { SocketIOGateway } from './socket-io.gateway';

/**
 * Factory that creates a BullRedisConfig from environment variables.
 */
function bullRedisConfigFactory(): BullRedisConfig {
  const opts = getRedisOptions();
  return {
    host: opts.host as string ?? 'localhost',
    port: opts.port as number ?? 6379,
  };
}

/**
 * Messaging infrastructure module.
 *
 * Provides all event dispatching, publishing, dead letter queue,
 * idempotency, and real-time WebSocket infrastructure for the application.
 *
 * Consumers import this module and inject services via their DI tokens:
 * - EVENT_DISPATCHER -> InProcessEventDispatcher
 * - INTEGRATION_EVENT_PUBLISHER -> BullQueueEventPublisher
 * - DeadLetterQueueService (class-based injection)
 * - IdempotencyStore (class-based injection)
 * - SocketIOEventEmitter (class-based injection)
 */
@Module({
  imports: [BullRootModuleConfig],
  providers: [
    // In-process event dispatcher (interface-based DI)
    {
      provide: EVENT_DISPATCHER,
      useClass: InProcessEventDispatcher,
    },
    InProcessEventDispatcher,

    // Bull integration event publisher (interface-based DI)
    {
      provide: BullQueueEventPublisher,
      useFactory: (): BullQueueEventPublisher => {
        return new BullQueueEventPublisher(bullRedisConfigFactory());
      },
    },
    {
      provide: INTEGRATION_EVENT_PUBLISHER,
      useExisting: BullQueueEventPublisher,
    },

    // Dead letter queue service
    {
      provide: DeadLetterQueueService,
      useFactory: (): DeadLetterQueueService => {
        return new DeadLetterQueueService(getRedisOptions());
      },
    },

    // Idempotency store
    {
      provide: IdempotencyStore,
      useFactory: (): IdempotencyStore => {
        return new IdempotencyStore(getRedisOptions());
      },
    },

    // Socket.IO event emitter and gateway
    SocketIOEventEmitter,
    SocketIOGateway,
  ],
  exports: [
    EVENT_DISPATCHER,
    InProcessEventDispatcher,
    INTEGRATION_EVENT_PUBLISHER,
    BullQueueEventPublisher,
    DeadLetterQueueService,
    IdempotencyStore,
    SocketIOEventEmitter,
    SocketIOGateway,
  ],
})
export class MessagingModule {}
