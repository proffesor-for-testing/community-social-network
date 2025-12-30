/**
 * NotificationQueue Unit Tests
 * TDD London School - Outside-In with Mocks
 * SPARC Phase 4 - M7 Notifications Module
 */

import { NotificationQueue } from '../../../src/notifications/notification.queue';
import {
  NotificationJobData,
  DeliveryResult,
  NotificationType,
  NotificationPriority,
  DeliveryChannel,
} from '../../../src/notifications/notification.types';

// Mock Bull Queue
interface MockJob {
  id: string;
  data: NotificationJobData;
  attemptsMade: number;
  progress: jest.Mock;
  remove: jest.Mock;
  retry: jest.Mock;
}

interface MockQueue {
  add: jest.Mock;
  process: jest.Mock;
  on: jest.Mock;
  getJob: jest.Mock;
  getJobs: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  close: jest.Mock;
  clean: jest.Mock;
  count: jest.Mock;
  getJobCounts: jest.Mock;
}

const createMockJob = (overrides: Partial<MockJob> = {}): MockJob => ({
  id: 'job-123',
  data: {
    notificationId: 'notif-123',
    recipientId: 'user-456',
    type: 'like',
    priority: 1,
    channels: ['websocket'],
  },
  attemptsMade: 0,
  progress: jest.fn(),
  remove: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createMockQueue = (): MockQueue => ({
  add: jest.fn().mockResolvedValue(createMockJob()),
  process: jest.fn(),
  on: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  clean: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }),
});

// Mock delivery handlers
interface MockDeliveryHandlers {
  websocket: jest.Mock;
  email: jest.Mock;
  push: jest.Mock;
}

const createMockDeliveryHandlers = (): MockDeliveryHandlers => ({
  websocket: jest.fn().mockResolvedValue({ delivered: true }),
  email: jest.fn().mockResolvedValue({ delivered: true }),
  push: jest.fn().mockResolvedValue({ delivered: true }),
});

describe('NotificationQueue', () => {
  let queue: NotificationQueue;
  let mockQueue: MockQueue;
  let mockDeliveryHandlers: MockDeliveryHandlers;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockDeliveryHandlers = createMockDeliveryHandlers();
    queue = new NotificationQueue(
      mockQueue as unknown as NotificationQueue['queue'],
      mockDeliveryHandlers as unknown as NotificationQueue['deliveryHandlers']
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should add notification job to queue', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'like',
        priority: 1,
        channels: ['websocket'],
      };

      // Act
      await queue.enqueue(jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        jobData,
        expect.any(Object)
      );
    });

    it('should set correct priority for high priority notifications', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'message',
        priority: 2, // High priority
        channels: ['websocket', 'push'],
      };

      // Act
      await queue.enqueue(jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        jobData,
        expect.objectContaining({
          priority: 2,
        })
      );
    });

    it('should set correct priority for low priority notifications', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'system',
        priority: 0, // Low priority
        channels: ['email'],
      };

      // Act
      await queue.enqueue(jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        jobData,
        expect.objectContaining({
          priority: 0,
        })
      );
    });

    it('should set retry options on job', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'like',
        priority: 1,
        channels: ['websocket'],
      };

      // Act
      await queue.enqueue(jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        jobData,
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: 'exponential',
          }),
        })
      );
    });

    it('should return job ID after enqueueing', async () => {
      // Arrange
      const mockJob = createMockJob({ id: 'job-456' });
      mockQueue.add.mockResolvedValue(mockJob);
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'like',
        priority: 1,
        channels: ['websocket'],
      };

      // Act
      const result = await queue.enqueue(jobData);

      // Assert
      expect(result.jobId).toBe('job-456');
    });
  });

  describe('processJob', () => {
    it('should deliver via websocket when channel is included', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'like',
        priority: 1,
        channels: ['websocket'],
      };

      // Act
      const result = await queue.processJob(jobData);

      // Assert
      expect(mockDeliveryHandlers.websocket).toHaveBeenCalledWith(jobData);
      expect(result).toContainEqual(
        expect.objectContaining({
          channel: 'websocket',
          delivered: true,
        })
      );
    });

    it('should deliver via email when channel is included', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'comment',
        priority: 1,
        channels: ['email'],
      };

      // Act
      const result = await queue.processJob(jobData);

      // Assert
      expect(mockDeliveryHandlers.email).toHaveBeenCalledWith(jobData);
      expect(result).toContainEqual(
        expect.objectContaining({
          channel: 'email',
          delivered: true,
        })
      );
    });

    it('should deliver via push when channel is included', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'mention',
        priority: 2,
        channels: ['push'],
      };

      // Act
      const result = await queue.processJob(jobData);

      // Assert
      expect(mockDeliveryHandlers.push).toHaveBeenCalledWith(jobData);
      expect(result).toContainEqual(
        expect.objectContaining({
          channel: 'push',
          delivered: true,
        })
      );
    });

    it('should deliver via multiple channels', async () => {
      // Arrange
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'message',
        priority: 2,
        channels: ['websocket', 'email', 'push'],
      };

      // Act
      const result = await queue.processJob(jobData);

      // Assert
      expect(mockDeliveryHandlers.websocket).toHaveBeenCalled();
      expect(mockDeliveryHandlers.email).toHaveBeenCalled();
      expect(mockDeliveryHandlers.push).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('should handle delivery failure gracefully', async () => {
      // Arrange
      mockDeliveryHandlers.websocket.mockResolvedValue({
        delivered: false,
        error: 'User offline',
      });
      const jobData: NotificationJobData = {
        notificationId: 'notif-123',
        recipientId: 'user-456',
        type: 'like',
        priority: 1,
        channels: ['websocket'],
      };

      // Act
      const result = await queue.processJob(jobData);

      // Assert
      expect(result).toContainEqual(
        expect.objectContaining({
          channel: 'websocket',
          delivered: false,
          error: 'User offline',
        })
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      // Arrange
      const mockJob = createMockJob({
        id: 'job-123',
        attemptsMade: 1,
      });
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const status = await queue.getJobStatus('job-123');

      // Assert
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(status).toEqual(
        expect.objectContaining({
          id: 'job-123',
          attemptsMade: 1,
        })
      );
    });

    it('should return null when job not found', async () => {
      // Arrange
      mockQueue.getJob.mockResolvedValue(null);

      // Act
      const status = await queue.getJobStatus('non-existent');

      // Assert
      expect(status).toBeNull();
    });
  });

  describe('removeJob', () => {
    it('should remove job from queue', async () => {
      // Arrange
      const mockJob = createMockJob();
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await queue.removeJob('job-123');

      // Assert
      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when job not found', async () => {
      // Arrange
      mockQueue.getJob.mockResolvedValue(null);

      // Act
      const result = await queue.removeJob('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('retryJob', () => {
    it('should retry failed job', async () => {
      // Arrange
      const mockJob = createMockJob();
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await queue.retryJob('job-123');

      // Assert
      expect(mockJob.retry).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when job not found', async () => {
      // Arrange
      mockQueue.getJob.mockResolvedValue(null);

      // Act
      const result = await queue.retryJob('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 3,
      });

      // Act
      const stats = await queue.getQueueStats();

      // Assert
      expect(stats).toEqual({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 3,
      });
    });
  });

  describe('pause and resume', () => {
    it('should pause the queue', async () => {
      // Act
      await queue.pause();

      // Assert
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume the queue', async () => {
      // Act
      await queue.resume();

      // Assert
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean completed jobs older than specified time', async () => {
      // Arrange
      const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours

      // Act
      await queue.cleanCompletedJobs(gracePeriod);

      // Assert
      expect(mockQueue.clean).toHaveBeenCalledWith(gracePeriod, 'completed');
    });

    it('should clean failed jobs older than specified time', async () => {
      // Arrange
      const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

      // Act
      await queue.cleanFailedJobs(gracePeriod);

      // Assert
      expect(mockQueue.clean).toHaveBeenCalledWith(gracePeriod, 'failed');
    });
  });

  describe('notification type handling', () => {
    const notificationTypes: Array<{
      type: NotificationType;
      priority: NotificationPriority;
      channels: DeliveryChannel[];
    }> = [
      { type: 'mention', priority: 1, channels: ['websocket', 'push'] },
      { type: 'like', priority: 1, channels: ['websocket'] },
      { type: 'comment', priority: 1, channels: ['websocket', 'email'] },
      { type: 'follow', priority: 1, channels: ['websocket'] },
      { type: 'group_invite', priority: 1, channels: ['websocket', 'email'] },
      { type: 'message', priority: 2, channels: ['websocket', 'push'] },
    ];

    notificationTypes.forEach(({ type, priority, channels }) => {
      it(`should enqueue ${type} notification with correct settings`, async () => {
        // Arrange
        const jobData: NotificationJobData = {
          notificationId: 'notif-123',
          recipientId: 'user-456',
          type,
          priority,
          channels,
        };

        // Act
        await queue.enqueue(jobData);

        // Assert
        expect(mockQueue.add).toHaveBeenCalledWith(
          'send-notification',
          expect.objectContaining({ type }),
          expect.objectContaining({ priority })
        );
      });
    });
  });

  describe('close', () => {
    it('should close the queue gracefully', async () => {
      // Act
      await queue.close();

      // Assert
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
