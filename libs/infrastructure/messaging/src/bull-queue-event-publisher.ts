import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Bull from 'bull';
import {
  IIntegrationEventPublisher,
  IntegrationEvent,
} from './integration-event-publisher.interface';

/**
 * Redis connection configuration for Bull queues.
 */
export interface BullRedisConfig {
  host: string;
  port: number;
}

/**
 * Default job options applied to all published integration events.
 */
const DEFAULT_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/**
 * Bull-based integration event publisher.
 *
 * Publishes integration events to named Bull queues backed by Redis.
 * Provides at-least-once delivery with exponential backoff retries.
 */
@Injectable()
export class BullQueueEventPublisher
  implements IIntegrationEventPublisher, OnModuleDestroy
{
  private readonly logger = new Logger(BullQueueEventPublisher.name);
  private readonly queues = new Map<string, Bull.Queue>();

  constructor(private readonly redisConfig: BullRedisConfig) {}

  /**
   * Publish an integration event to the specified queue.
   * A Bull Queue instance is created lazily per queue name and reused.
   */
  async publish(queueName: string, event: IntegrationEvent): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);

    await queue.add(event.type, {
      id: event.id,
      type: event.type,
      occurredOn: event.occurredOn.toISOString(),
      payload: event.payload,
      metadata: event.metadata,
    }, {
      jobId: event.id,
      ...DEFAULT_JOB_OPTIONS,
    });

    this.logger.debug(
      `Published event "${event.type}" (id: ${event.id}) to queue "${queueName}"`,
    );
  }

  /**
   * Gracefully close all queue connections on module destroy.
   */
  async onModuleDestroy(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    this.queues.forEach((queue, name) => {
      this.logger.log(`Closing queue "${name}"`);
      closePromises.push(queue.close());
    });
    await Promise.all(closePromises);
    this.queues.clear();
  }

  private getOrCreateQueue(queueName: string): Bull.Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Bull(queueName, {
        redis: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(queueName, queue);
      this.logger.log(`Created queue "${queueName}"`);
    }
    return queue;
  }
}
