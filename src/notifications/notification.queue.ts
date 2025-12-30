/**
 * NotificationQueue
 * Bull Queue-based reliable notification processing
 * M7 Notifications Module - SPARC Phase 4 TDD Implementation
 */

import {
  NotificationJobData,
  DeliveryResult,
  DeliveryChannel,
} from './notification.types';

// Type definitions for Bull Queue compatibility
interface Job {
  id: string;
  data: NotificationJobData;
  attemptsMade: number;
  progress(value: number): Promise<void>;
  remove(): Promise<void>;
  retry(): Promise<void>;
}

interface Queue {
  add(
    name: string,
    data: NotificationJobData,
    options: JobOptions
  ): Promise<Job>;
  process(
    name: string,
    concurrency: number,
    processor: (job: Job) => Promise<unknown>
  ): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  getJob(jobId: string): Promise<Job | null>;
  getJobs(
    types: string[],
    start?: number,
    end?: number
  ): Promise<Job[]>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
  clean(grace: number, status: string): Promise<Job[]>;
  count(): Promise<number>;
  getJobCounts(): Promise<QueueStats>;
}

interface JobOptions {
  priority: number;
  attempts: number;
  backoff: {
    type: string;
    delay: number;
  };
  removeOnComplete?: {
    age: number;
    count: number;
  };
  removeOnFail?: {
    age: number;
  };
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface DeliveryHandler {
  (jobData: NotificationJobData): Promise<{
    delivered: boolean;
    error?: string;
    deliveredAt?: Date;
  }>;
}

interface DeliveryHandlers {
  websocket: DeliveryHandler;
  email: DeliveryHandler;
  push: DeliveryHandler;
}

// Default job options
const DEFAULT_JOB_OPTIONS: Omit<JobOptions, 'priority'> = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // 7 days
  },
};

export class NotificationQueue {
  queue: Queue;
  deliveryHandlers: DeliveryHandlers;

  constructor(queue: Queue, deliveryHandlers: DeliveryHandlers) {
    this.queue = queue;
    this.deliveryHandlers = deliveryHandlers;
  }

  /**
   * Add a notification job to the queue
   *
   * @param jobData - Notification job data
   * @returns Job ID and status
   */
  async enqueue(
    jobData: NotificationJobData
  ): Promise<{ jobId: string; status: string }> {
    const options: JobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      priority: jobData.priority,
    };

    const job = await this.queue.add('send-notification', jobData, options);

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  /**
   * Process a notification job - deliver via specified channels
   *
   * @param jobData - Notification job data
   * @returns Array of delivery results for each channel
   */
  async processJob(jobData: NotificationJobData): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const channel of jobData.channels) {
      const handler = this.getDeliveryHandler(channel);
      if (handler) {
        try {
          const result = await handler(jobData);
          results.push({
            notificationId: jobData.notificationId,
            channel,
            delivered: result.delivered,
            deliveredAt: result.delivered ? new Date() : undefined,
            error: result.error,
          });
        } catch (error) {
          results.push({
            notificationId: jobData.notificationId,
            channel,
            delivered: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Get delivery handler for a specific channel
   *
   * @param channel - Delivery channel
   * @returns Handler function or undefined
   */
  private getDeliveryHandler(channel: DeliveryChannel): DeliveryHandler | undefined {
    return this.deliveryHandlers[channel];
  }

  /**
   * Get status of a specific job
   *
   * @param jobId - Job ID
   * @returns Job status or null if not found
   */
  async getJobStatus(
    jobId: string
  ): Promise<{ id: string; data: NotificationJobData; attemptsMade: number } | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      data: job.data,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Remove a job from the queue
   *
   * @param jobId - Job ID
   * @returns True if removed, false if not found
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Retry a failed job
   *
   * @param jobId - Job ID
   * @returns True if retried, false if not found
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.retry();
    return true;
  }

  /**
   * Get queue statistics
   *
   * @returns Queue job counts by status
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.queue.getJobCounts();
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
  }

  /**
   * Clean completed jobs older than specified time
   *
   * @param gracePeriod - Time in milliseconds
   */
  async cleanCompletedJobs(gracePeriod: number): Promise<void> {
    await this.queue.clean(gracePeriod, 'completed');
  }

  /**
   * Clean failed jobs older than specified time
   *
   * @param gracePeriod - Time in milliseconds
   */
  async cleanFailedJobs(gracePeriod: number): Promise<void> {
    await this.queue.clean(gracePeriod, 'failed');
  }

  /**
   * Close the queue gracefully
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}
