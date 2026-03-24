import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationTriggerConsumer } from '../notification-trigger.consumer';
import { IAlertRepository } from '@csn/domain-notification';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockAlertRepository(): IAlertRepository {
  return {
    nextId: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    findByRecipientId: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    countUnread: vi.fn().mockResolvedValue(0),
  };
}

function createMockIdempotencyStore() {
  return {
    isProcessed: vi.fn().mockResolvedValue(false),
    markProcessed: vi.fn().mockResolvedValue(undefined),
    ensureIdempotent: vi.fn().mockImplementation(
      async (_eventId: string, handler: () => Promise<void>) => {
        await handler();
        return true;
      },
    ),
    onModuleDestroy: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationTriggerConsumer', () => {
  let consumer: NotificationTriggerConsumer;
  let alertRepository: ReturnType<typeof createMockAlertRepository>;
  let idempotencyStore: ReturnType<typeof createMockIdempotencyStore>;

  beforeEach(() => {
    alertRepository = createMockAlertRepository();
    idempotencyStore = createMockIdempotencyStore();
    consumer = new NotificationTriggerConsumer(
      alertRepository as unknown as IAlertRepository,
      idempotencyStore as any,
    );
  });

  describe('handle', () => {
    it('should process FollowRequested events and create a FOLLOW alert', async () => {
      const payload = {
        type: 'FollowRequested',
        eventId: 'evt-001',
        aggregateId: 'conn-001',
        followerId: '11111111-1111-1111-1111-111111111111',
        followeeId: '22222222-2222-2222-2222-222222222222',
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'notification:follow:evt-001',
        expect.any(Function),
      );
      expect(alertRepository.save).toHaveBeenCalledTimes(1);

      const savedAlert = (alertRepository.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedAlert.recipientId.value).toBe('22222222-2222-2222-2222-222222222222');
      expect(savedAlert.type).toBe('FOLLOW');
      expect(savedAlert.sourceId).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('should process MemberMentioned events and create a MENTION alert', async () => {
      const payload = {
        type: 'MemberMentioned',
        eventId: 'evt-002',
        aggregateId: '33333333-3333-3333-3333-333333333333',
        mentionedUserId: '44444444-4444-4444-4444-444444444444',
        contentType: 'publication',
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'notification:mention:evt-002',
        expect.any(Function),
      );
      expect(alertRepository.save).toHaveBeenCalledTimes(1);

      const savedAlert = (alertRepository.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedAlert.recipientId.value).toBe('44444444-4444-4444-4444-444444444444');
      expect(savedAlert.type).toBe('MENTION');
    });

    it('should process PublicationCreated events idempotently', async () => {
      const payload = {
        type: 'PublicationCreated',
        eventId: 'evt-003',
        aggregateId: 'pub-001',
        authorId: '55555555-5555-5555-5555-555555555555',
        visibility: 'public',
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'notification:pub:evt-003',
        expect.any(Function),
      );
    });

    it('should process DiscussionCreated events idempotently', async () => {
      const payload = {
        type: 'DiscussionCreated',
        eventId: 'evt-004',
        aggregateId: 'disc-001',
        authorId: '66666666-6666-6666-6666-666666666666',
        publicationId: 'pub-001',
        parentId: null,
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'notification:disc:evt-004',
        expect.any(Function),
      );
    });

    it('should process ReactionAdded events idempotently', async () => {
      const payload = {
        type: 'ReactionAdded',
        eventId: 'evt-005',
        aggregateId: 'pub-001',
        userId: '77777777-7777-7777-7777-777777777777',
        reactionType: 'LIKE',
        targetId: 'pub-001',
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'notification:react:evt-005',
        expect.any(Function),
      );
    });

    it('should skip duplicate events via idempotency store', async () => {
      // Simulate idempotency store saying event was already processed
      idempotencyStore.ensureIdempotent.mockImplementation(
        async (_eventId: string, _handler: () => Promise<void>) => {
          // Handler is NOT called - event was already processed
          return false;
        },
      );

      const payload = {
        type: 'FollowRequested',
        eventId: 'evt-duplicate',
        aggregateId: 'conn-001',
        followerId: '11111111-1111-1111-1111-111111111111',
        followeeId: '22222222-2222-2222-2222-222222222222',
      };

      await consumer.handle(payload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalled();
      expect(alertRepository.save).not.toHaveBeenCalled();
    });

    it('should warn on unknown event types', async () => {
      const payload = {
        type: 'UnknownEvent',
        eventId: 'evt-unknown',
      };

      // Should not throw, just log a warning
      await expect(consumer.handle(payload)).resolves.toBeUndefined();
    });
  });
});
