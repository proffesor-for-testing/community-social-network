/**
 * Persistence: PostgresAlertRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { RUN_DB_TESTS, truncateAll, getAlertRepository, createTestAlert } from '../setup/db';
import type { PostgresAlertRepository } from '@csn/infra-notification';

describe.skipIf(!RUN_DB_TESTS)('PostgresAlertRepository', () => {
  let repository: PostgresAlertRepository;

  beforeAll(async () => {
    repository = await getAlertRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips an alert through save and findById', async () => {
    const recipientId = randomUUID();
    const alert = createTestAlert(recipientId);

    await repository.save(alert);
    const found = await repository.findById(alert.id);

    expect(found?.recipientId.value).toBe(recipientId);
  });

  it('findByRecipientId lists alerts for that recipient, most recent first', async () => {
    const recipientId = randomUUID();
    const first = createTestAlert(recipientId);
    await repository.save(first);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = createTestAlert(recipientId);
    await repository.save(second);

    // Alert belonging to a different recipient must not leak into the result.
    await repository.save(createTestAlert(randomUUID()));

    const result = await repository.findByRecipientId(UserId.create(recipientId));

    expect(result.items.map((a) => a.id.value)).toEqual([second.id.value, first.id.value]);
  });

  it('countUnread counts only UNREAD alerts for the recipient', async () => {
    const recipientId = randomUUID();
    const unread = createTestAlert(recipientId);
    await repository.save(unread);

    const read = createTestAlert(recipientId);
    read.markAsRead();
    await repository.save(read);

    const count = await repository.countUnread(UserId.create(recipientId));

    expect(count).toBe(1);
  });

  it('persists markAsRead so a reloaded alert reports isUnread() false', async () => {
    const recipientId = randomUUID();
    const alert = createTestAlert(recipientId);
    await repository.save(alert);

    const loaded = await repository.findById(alert.id);
    loaded!.markAsRead();
    await repository.save(loaded!);

    const reloaded = await repository.findById(alert.id);

    expect(reloaded?.isUnread()).toBe(false);
  });
});
