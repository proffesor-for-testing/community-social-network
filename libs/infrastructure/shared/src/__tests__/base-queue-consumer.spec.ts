import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseQueueConsumer } from '../messaging/base-queue-consumer';

interface TestPayload {
  data: string;
}

function createMockLogger() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockJob(payload: TestPayload, overrides: Record<string, unknown> = {}) {
  return {
    id: '123',
    data: payload,
    attemptsMade: 0,
    ...overrides,
  } as any;
}

class TestConsumer extends BaseQueueConsumer<TestPayload> {
  protected readonly logger = createMockLogger() as any;
  public handleFn = vi.fn<[TestPayload, any], Promise<void>>().mockResolvedValue(undefined);

  protected async handle(payload: TestPayload, job: any): Promise<void> {
    return this.handleFn(payload, job);
  }

  getLogger() {
    return this.logger;
  }
}

describe('BaseQueueConsumer', () => {
  let consumer: TestConsumer;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    consumer = new TestConsumer();
    logger = consumer.getLogger();
  });

  describe('process()', () => {
    it('should call handle() with the job payload and job object', async () => {
      const payload: TestPayload = { data: 'test-value' };
      const job = createMockJob(payload);

      await consumer.process(job);

      expect(consumer.handleFn).toHaveBeenCalledOnce();
      expect(consumer.handleFn).toHaveBeenCalledWith(payload, job);
    });

    it('should log the start of processing with job id and attempt number', async () => {
      const job = createMockJob({ data: 'test' }, { attemptsMade: 2 });

      await consumer.process(job);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing job 123'),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('attempt 3'),
      );
    });

    it('should log completion with duration on success', async () => {
      const job = createMockJob({ data: 'test' });

      await consumer.process(job);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringMatching(/Job 123 completed in \d+ms/),
      );
    });

    it('should log error and re-throw when handle() fails', async () => {
      const error = new Error('Processing failed');
      consumer.handleFn.mockRejectedValue(error);
      const job = createMockJob({ data: 'test' });

      await expect(consumer.process(job)).rejects.toThrow('Processing failed');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Job 123 failed after \d+ms: Processing failed/),
      );
    });

    it('should log stringified error when handle() throws a non-Error', async () => {
      consumer.handleFn.mockRejectedValue('string-error');
      const job = createMockJob({ data: 'test' });

      await expect(consumer.process(job)).rejects.toBe('string-error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('string-error'),
      );
    });

    it('should call log exactly twice on success (start + completion)', async () => {
      const job = createMockJob({ data: 'test' });

      await consumer.process(job);

      expect(logger.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('onFailed()', () => {
    it('should log permanent failure with job id, attempt count, and error message', () => {
      const job = createMockJob({ data: 'test' }, { attemptsMade: 3 });
      const error = new Error('Fatal failure');

      consumer.onFailed(job, error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Job 123 permanently failed after 3 attempts: Fatal failure'),
      );
    });

    it('should log with zero attempts if the job failed immediately', () => {
      const job = createMockJob({ data: 'test' }, { attemptsMade: 0 });
      const error = new Error('Immediate failure');

      consumer.onFailed(job, error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed after 0 attempts'),
      );
    });
  });
});
