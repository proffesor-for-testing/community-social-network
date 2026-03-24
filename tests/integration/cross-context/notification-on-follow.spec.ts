/**
 * Cross-Context Integration Test: Notification on Follow
 *
 * Validates that when User A follows User B, the NotificationTriggerConsumer
 * receives the FollowRequested event and creates an Alert for User B.
 *
 * Flow:
 * 1. User A follows User B (creates a PENDING connection)
 * 2. Extract FollowRequested event data
 * 3. Feed the event payload to NotificationTriggerConsumer
 * 4. Verify an Alert is created for User B
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

// ── Social graph handlers ───────────────────────────────────────────────────

import { FollowMemberHandler } from '../../../apps/api/src/modules/social-graph/commands/follow-member.handler';
import { FollowMemberCommand } from '../../../apps/api/src/modules/social-graph/commands/follow-member.command';

// ── Cross-context consumer ──────────────────────────────────────────────────

import { NotificationTriggerConsumer } from '../../../apps/api/src/consumers/notification-trigger.consumer';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  MockIdempotencyStore,
} from '../../setup/test-app';
import { UserId } from '@csn/domain-shared';

describe('Cross-Context: Notification on Follow', () => {
  let repos: TestRepositories;
  let mockIdempotency: MockIdempotencyStore;

  let followHandler: FollowMemberHandler;
  let notificationConsumer: NotificationTriggerConsumer;

  const userA = randomUUID(); // follower
  const userB = randomUUID(); // followee (receives notification)

  beforeEach(() => {
    repos = createTestRepositories();
    mockIdempotency = new MockIdempotencyStore();

    // Direct instantiation to avoid NestJS DI class-token issues
    followHandler = new FollowMemberHandler(
      repos.connectionRepo,
      repos.blockRepo,
    );
    notificationConsumer = new NotificationTriggerConsumer(
      repos.alertRepo,
      mockIdempotency as any,
    );
  });

  // ── Step 1: User A follows User B ─────────────────────────────────────

  it('should create a follow request', async () => {
    const result = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );

    expect(result.status).toBe('PENDING');
    expect(result.followerId).toBe(userA);
    expect(result.followeeId).toBe(userB);
  });

  // ── Step 2-3: NotificationTriggerConsumer processes FollowRequested ───

  it('should create an alert for User B when FollowRequested event is processed', async () => {
    // First, create the follow request
    await followHandler.execute(new FollowMemberCommand(userA, userB));

    // Simulate the FollowRequested integration event payload
    const eventPayload = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(), // connection ID
      followerId: userA,
      followeeId: userB,
    };

    // Feed to consumer
    await notificationConsumer.handle(eventPayload);

    // Step 4: Verify an Alert was created for User B
    const alerts = await repos.alertRepo.findByRecipientId(
      UserId.create(userB),
    );

    expect(alerts.total).toBe(1);
    expect(alerts.items).toHaveLength(1);
    expect(alerts.items[0].recipientId.value).toBe(userB);
  });

  // ── Alert has correct type ────────────────────────────────────────────

  it('should create a FOLLOW-type alert', async () => {
    const eventPayload = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      followerId: userA,
      followeeId: userB,
    };

    await notificationConsumer.handle(eventPayload);

    const alerts = await repos.alertRepo.findByRecipientId(
      UserId.create(userB),
    );
    expect(alerts.items[0].type).toBe('FOLLOW');
  });

  // ── Alert is unread ───────────────────────────────────────────────────

  it('should create alert with UNREAD status', async () => {
    const eventPayload = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      followerId: userA,
      followeeId: userB,
    };

    await notificationConsumer.handle(eventPayload);

    const unreadCount = await repos.alertRepo.countUnread(
      UserId.create(userB),
    );
    expect(unreadCount).toBe(1);
  });

  // ── Idempotent notification creation ──────────────────────────────────

  it('should not create duplicate alerts for the same event', async () => {
    const eventPayload = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      followerId: userA,
      followeeId: userB,
    };

    // Process twice
    await notificationConsumer.handle(eventPayload);
    await notificationConsumer.handle(eventPayload);

    // Only one alert should exist
    const alerts = await repos.alertRepo.findByRecipientId(
      UserId.create(userB),
    );
    expect(alerts.total).toBe(1);
  });

  // ── Multiple followers create multiple alerts ─────────────────────────

  it('should create separate alerts for different follow events', async () => {
    const userC = randomUUID();

    // User A follows User B
    const event1 = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      followerId: userA,
      followeeId: userB,
    };
    await notificationConsumer.handle(event1);

    // User C follows User B
    const event2 = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      followerId: userC,
      followeeId: userB,
    };
    await notificationConsumer.handle(event2);

    const alerts = await repos.alertRepo.findByRecipientId(
      UserId.create(userB),
    );
    expect(alerts.total).toBe(2);
  });

  // ── Consumer handles other event types ────────────────────────────────

  it('should handle PublicationCreated events without error', async () => {
    const eventPayload = {
      type: 'PublicationCreated',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      authorId: userA,
      visibility: 'PUBLIC',
    };

    await expect(notificationConsumer.handle(eventPayload)).resolves.not.toThrow();
  });

  // ── Consumer ignores unknown event types ──────────────────────────────

  it('should handle unknown event types without throwing', async () => {
    const eventPayload = {
      type: 'UnknownEvent',
      eventId: randomUUID(),
    };

    await expect(notificationConsumer.handle(eventPayload)).resolves.not.toThrow();
    expect(repos.alertRepo.size).toBe(0);
  });

  // ── Full cross-context flow ───────────────────────────────────────────

  it('should complete full follow -> event -> notification flow', async () => {
    // 1. User A follows User B
    const followResult = await followHandler.execute(
      new FollowMemberCommand(userA, userB),
    );
    expect(followResult.status).toBe('PENDING');

    // 2. Simulate the FollowRequested integration event
    const eventPayload = {
      type: 'FollowRequested',
      eventId: randomUUID(),
      aggregateId: followResult.id,
      followerId: userA,
      followeeId: userB,
    };

    // 3. Consumer processes event
    await notificationConsumer.handle(eventPayload);

    // 4. Verify notification created for User B
    const alerts = await repos.alertRepo.findByRecipientId(
      UserId.create(userB),
    );
    expect(alerts.total).toBe(1);
    expect(alerts.items[0].recipientId.value).toBe(userB);
    expect(alerts.items[0].type).toBe('FOLLOW');

    // 5. Verify unread count
    const unreadCount = await repos.alertRepo.countUnread(
      UserId.create(userB),
    );
    expect(unreadCount).toBe(1);
  });
});
