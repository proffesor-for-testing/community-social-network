import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
  AlertStatus,
} from '@csn/domain-notification';
import { InMemoryAlertRepository } from '../repositories/in-memory-alert.repository';

describe('InMemoryAlertRepository', () => {
  let repository: InMemoryAlertRepository;

  const createAlert = (
    recipientId?: UserId,
    type: AlertType = AlertType.FOLLOW,
  ): Alert => {
    const id = AlertId.generate();
    const recipient = recipientId ?? UserId.generate();
    const content = AlertContent.create('Title', 'Body', '/action');
    return Alert.create(id, recipient, type, content, 'source-1');
  };

  beforeEach(() => {
    repository = new InMemoryAlertRepository();
  });

  describe('nextId', () => {
    it('should generate unique AlertId instances', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve an alert', async () => {
      const alert = createAlert();

      await repository.save(alert);
      const found = await repository.findById(alert.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(alert.id.value);
      expect(found!.status).toBe(AlertStatus.UNREAD);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(AlertId.generate());
      expect(found).toBeNull();
    });

    it('should overwrite on save with same id', async () => {
      const alert = createAlert();
      await repository.save(alert);

      alert.markAsRead();
      await repository.save(alert);

      const found = await repository.findById(alert.id);
      expect(found!.status).toBe(AlertStatus.READ);
    });
  });

  describe('exists', () => {
    it('should return true for a saved alert', async () => {
      const alert = createAlert();
      await repository.save(alert);

      expect(await repository.exists(alert.id)).toBe(true);
    });

    it('should return false for a non-existent alert', async () => {
      expect(await repository.exists(AlertId.generate())).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove an alert from the store', async () => {
      const alert = createAlert();
      await repository.save(alert);
      expect(repository.size).toBe(1);

      await repository.delete(alert);

      expect(repository.size).toBe(0);
      expect(await repository.findById(alert.id)).toBeNull();
    });
  });

  describe('findByRecipientId', () => {
    it('should return alerts for a specific recipient', async () => {
      const recipientId = UserId.generate();
      const alert1 = createAlert(recipientId);
      const alert2 = createAlert(recipientId);
      const otherAlert = createAlert(); // different recipient

      await repository.save(alert1);
      await repository.save(alert2);
      await repository.save(otherAlert);

      const result = await repository.findByRecipientId(recipientId);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items.every((a) => a.recipientId.value === recipientId.value)).toBe(
        true,
      );
    });

    it('should return empty result for unknown recipient', async () => {
      const result = await repository.findByRecipientId(UserId.generate());

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should support pagination', async () => {
      const recipientId = UserId.generate();
      for (let i = 0; i < 5; i++) {
        await repository.save(createAlert(recipientId));
      }

      const page1 = await repository.findByRecipientId(recipientId, {
        page: 1,
        pageSize: 2,
      });
      const page2 = await repository.findByRecipientId(recipientId, {
        page: 2,
        pageSize: 2,
      });
      const page3 = await repository.findByRecipientId(recipientId, {
        page: 3,
        pageSize: 2,
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      expect(page2.items).toHaveLength(2);
      expect(page2.hasNextPage).toBe(true);
      expect(page2.hasPreviousPage).toBe(true);

      expect(page3.items).toHaveLength(1);
      expect(page3.hasNextPage).toBe(false);
      expect(page3.hasPreviousPage).toBe(true);
    });

    it('should use default pagination when not provided', async () => {
      const recipientId = UserId.generate();
      await repository.save(createAlert(recipientId));

      const result = await repository.findByRecipientId(recipientId);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('countUnread', () => {
    it('should count only unread alerts for a recipient', async () => {
      const recipientId = UserId.generate();
      const alert1 = createAlert(recipientId);
      const alert2 = createAlert(recipientId);
      const alert3 = createAlert(recipientId);

      await repository.save(alert1);
      await repository.save(alert2);
      await repository.save(alert3);

      // Mark one as read
      alert2.markAsRead();
      await repository.save(alert2);

      const count = await repository.countUnread(recipientId);
      expect(count).toBe(2);
    });

    it('should return 0 for a recipient with no alerts', async () => {
      const count = await repository.countUnread(UserId.generate());
      expect(count).toBe(0);
    });

    it('should not count dismissed alerts', async () => {
      const recipientId = UserId.generate();
      const alert = createAlert(recipientId);
      alert.dismiss();
      await repository.save(alert);

      const count = await repository.countUnread(recipientId);
      expect(count).toBe(0);
    });

    it('should not count alerts from other recipients', async () => {
      const recipientId = UserId.generate();
      const otherRecipientId = UserId.generate();

      await repository.save(createAlert(recipientId));
      await repository.save(createAlert(otherRecipientId));
      await repository.save(createAlert(otherRecipientId));

      const count = await repository.countUnread(recipientId);
      expect(count).toBe(1);
    });
  });

  describe('test helpers', () => {
    it('should report correct size', async () => {
      expect(repository.size).toBe(0);

      await repository.save(createAlert());
      expect(repository.size).toBe(1);

      await repository.save(createAlert());
      expect(repository.size).toBe(2);
    });

    it('should clear all stored alerts', async () => {
      await repository.save(createAlert());
      await repository.save(createAlert());
      expect(repository.size).toBe(2);

      repository.clear();

      expect(repository.size).toBe(0);
    });
  });
});
