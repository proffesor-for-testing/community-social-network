import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
  AlertStatus,
} from '@csn/domain-notification';
import { InMemoryAlertRepository } from '@csn/infra-notification';
import { MarkReadHandler } from '../commands/mark-read.handler';
import { MarkReadCommand } from '../commands/mark-read.command';

describe('MarkReadHandler', () => {
  let handler: MarkReadHandler;
  let alertRepository: InMemoryAlertRepository;

  const recipientId = UserId.generate();

  const createAlert = (
    recipient: UserId = recipientId,
    type: AlertType = AlertType.FOLLOW,
  ): Alert => {
    const id = AlertId.generate();
    const content = AlertContent.create('New follower', 'Jane started following you', '/profile/jane');
    return Alert.create(id, recipient, type, content, 'source-123');
  };

  beforeEach(() => {
    alertRepository = new InMemoryAlertRepository();
    handler = new MarkReadHandler(alertRepository);
  });

  it('should mark an unread alert as read', async () => {
    const alert = createAlert();
    await alertRepository.save(alert);

    await handler.execute(new MarkReadCommand(alert.id.value, recipientId.value));

    const updated = await alertRepository.findById(alert.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe(AlertStatus.READ);
    expect(updated!.readAt).not.toBeNull();
  });

  it('should throw NotFoundException when alert does not exist', async () => {
    const fakeId = AlertId.generate().value;

    await expect(
      handler.execute(new MarkReadCommand(fakeId, recipientId.value)),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when memberId does not match recipientId', async () => {
    const alert = createAlert();
    await alertRepository.save(alert);

    const otherMemberId = UserId.generate().value;

    await expect(
      handler.execute(new MarkReadCommand(alert.id.value, otherMemberId)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw DomainError when alert is already read', async () => {
    const alert = createAlert();
    alert.markAsRead();
    await alertRepository.save(alert);

    await expect(
      handler.execute(new MarkReadCommand(alert.id.value, recipientId.value)),
    ).rejects.toThrow(/Invalid alert status transition/);
  });

  it('should throw DomainError when alert is dismissed', async () => {
    const alert = createAlert();
    alert.dismiss();
    await alertRepository.save(alert);

    await expect(
      handler.execute(new MarkReadCommand(alert.id.value, recipientId.value)),
    ).rejects.toThrow(/Invalid alert status transition/);
  });

  it('should preserve recipientId after marking as read', async () => {
    const alert = createAlert();
    await alertRepository.save(alert);

    await handler.execute(new MarkReadCommand(alert.id.value, recipientId.value));

    const updated = await alertRepository.findById(alert.id);
    expect(updated!.recipientId.value).toBe(recipientId.value);
  });

  it('should not affect other alerts when marking one as read', async () => {
    const alert1 = createAlert();
    const alert2 = createAlert();
    await alertRepository.save(alert1);
    await alertRepository.save(alert2);

    await handler.execute(new MarkReadCommand(alert1.id.value, recipientId.value));

    const updated1 = await alertRepository.findById(alert1.id);
    const updated2 = await alertRepository.findById(alert2.id);
    expect(updated1!.status).toBe(AlertStatus.READ);
    expect(updated2!.status).toBe(AlertStatus.UNREAD);
  });
});
