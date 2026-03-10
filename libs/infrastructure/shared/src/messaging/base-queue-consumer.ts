import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Base class for Bull Queue consumers with standardized error handling,
 * retry logic, and dead letter queue support.
 */
export abstract class BaseQueueConsumer<TPayload = unknown> {
  protected abstract readonly logger: Logger;

  /**
   * Override in subclass to process the job payload.
   */
  protected abstract handle(payload: TPayload, job: Job<TPayload>): Promise<void>;

  /**
   * Entry point called by Bull's @Process() decorator.
   */
  async process(job: Job<TPayload>): Promise<void> {
    const startTime = Date.now();
    const jobId = job.id;

    this.logger.log(`Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

    try {
      await this.handle(job.data, job);
      const duration = Date.now() - startTime;
      this.logger.log(`Job ${jobId} completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Job ${jobId} failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // Let Bull handle retry/DLQ
    }
  }

  /**
   * Called when job permanently fails (all retries exhausted).
   */
  onFailed(job: Job<TPayload>, error: Error): void {
    this.logger.error(
      `Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }
}
