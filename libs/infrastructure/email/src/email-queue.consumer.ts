import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailService, EmailOptions } from './email.service';

export interface EmailJobData {
  to: string;
  subject: string;
  template?: string;
  templateContext?: Record<string, unknown>;
  html?: string;
  text?: string;
  retryCount?: number;
}

/**
 * Bull queue consumer for asynchronous email sending.
 * Processes email jobs from the 'email' queue with retry logic.
 *
 * In production, this would be registered as a Bull processor:
 *   @Processor('email')
 *   @Process('send')
 *
 * For now, it provides a processJob method that can be called
 * directly or from a Bull queue processor.
 */
@Injectable()
export class EmailQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueConsumer.name);
  private readonly MAX_RETRIES = 3;

  constructor(private readonly emailService: EmailService) {}

  onModuleInit(): void {
    this.logger.log('Email queue consumer initialized');
  }

  /**
   * Processes a single email job.
   * Can be called directly or from a Bull queue processor.
   */
  async processJob(data: EmailJobData): Promise<void> {
    const retryCount = data.retryCount || 0;

    try {
      const options: EmailOptions = {
        to: data.to,
        subject: data.subject,
        template: data.template,
        templateContext: data.templateContext,
        html: data.html,
        text: data.text,
      };

      await this.emailService.send(options);
      this.logger.log(`Email sent to ${data.to}: ${data.subject}`);
    } catch (error) {
      this.logger.error(
        `Email delivery failed (attempt ${retryCount + 1}/${this.MAX_RETRIES}): ${data.to}`,
        error,
      );

      if (retryCount < this.MAX_RETRIES - 1) {
        // In a Bull queue setup, this would throw to trigger automatic retry
        // For direct usage, we retry manually with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.processJob({ ...data, retryCount: retryCount + 1 });
      } else {
        this.logger.error(
          `Email delivery permanently failed after ${this.MAX_RETRIES} attempts: ${data.to}`,
        );
        throw error;
      }
    }
  }

  /**
   * Enqueues an email for async delivery.
   * In production, this would add to a Bull queue.
   * Currently processes inline as a fallback.
   */
  async enqueue(data: EmailJobData): Promise<void> {
    // In production with Bull:
    //   await this.emailQueue.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    // For now, process directly (fire-and-forget):
    this.processJob(data).catch((err) => {
      this.logger.error(`Async email processing failed: ${err.message}`);
    });
  }
}
