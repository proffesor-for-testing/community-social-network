import { describe, it, expect } from 'vitest';
import { UserId } from '@csn/domain-shared';
import { Alert } from '../aggregates/alert';
import { AlertId } from '../value-objects/alert-id';
import { AlertType } from '../value-objects/alert-type';
import { AlertContent } from '../value-objects/alert-content';
import { AlertStatus } from '../value-objects/alert-status';
import { AlertCreatedEvent } from '../events/alert-created.event';
import { AlertReadEvent } from '../events/alert-read.event';

describe('Alert Aggregate', () => {
  const createAlert = () => {
    const id = AlertId.generate();
    const recipientId = UserId.generate();
    const content = AlertContent.create('New follower', 'John started following you', '/profile/john');
    return Alert.create(id, recipientId, AlertType.FOLLOW, content, 'source-entity-123');
  };

  describe('create', () => {
    it('should create an alert with UNREAD status', () => {
      const alert = createAlert();

      expect(alert.status).toBe(AlertStatus.UNREAD);
      expect(alert.type).toBe(AlertType.FOLLOW);
      expect(alert.content.title).toBe('New follower');
      expect(alert.content.body).toBe('John started following you');
      expect(alert.content.actionUrl).toBe('/profile/john');
      expect(alert.sourceId).toBe('source-entity-123');
      expect(alert.readAt).toBeNull();
      expect(alert.isUnread()).toBe(true);
    });

    it('should emit AlertCreatedEvent on creation', () => {
      const alert = createAlert();
      const events = alert.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AlertCreatedEvent);

      const event = events[0] as AlertCreatedEvent;
      expect(event.aggregateId).toBe(alert.id.value);
      expect(event.recipientId).toBe(alert.recipientId.value);
      expect(event.alertType).toBe(AlertType.FOLLOW);
      expect(event.aggregateType).toBe('Alert');
      expect(event.eventType).toBe('AlertCreated');
    });

    it('should set version to 1 after creation', () => {
      const alert = createAlert();
      expect(alert.version).toBe(1);
    });

    it('should reject empty sourceId', () => {
      const id = AlertId.generate();
      const recipientId = UserId.generate();
      const content = AlertContent.create('Title', 'Body');

      expect(() => Alert.create(id, recipientId, AlertType.LIKE, content, '')).toThrow(
        'Alert sourceId must not be empty',
      );
    });

    it('should reject whitespace-only sourceId', () => {
      const id = AlertId.generate();
      const recipientId = UserId.generate();
      const content = AlertContent.create('Title', 'Body');

      expect(() => Alert.create(id, recipientId, AlertType.LIKE, content, '   ')).toThrow(
        'Alert sourceId must not be empty',
      );
    });
  });

  describe('markAsRead', () => {
    it('should transition from UNREAD to READ', () => {
      const alert = createAlert();
      alert.pullDomainEvents(); // clear creation events

      alert.markAsRead();

      expect(alert.status).toBe(AlertStatus.READ);
      expect(alert.readAt).not.toBeNull();
      expect(alert.isUnread()).toBe(false);
    });

    it('should emit AlertReadEvent', () => {
      const alert = createAlert();
      alert.pullDomainEvents();

      alert.markAsRead();
      const events = alert.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AlertReadEvent);
      expect(events[0].aggregateType).toBe('Alert');
    });

    it('should increment version', () => {
      const alert = createAlert();
      expect(alert.version).toBe(1);

      alert.markAsRead();
      expect(alert.version).toBe(2);
    });

    it('should throw when already READ', () => {
      const alert = createAlert();
      alert.markAsRead();

      expect(() => alert.markAsRead()).toThrow('Invalid alert status transition from READ to READ');
    });

    it('should throw when DISMISSED', () => {
      const alert = createAlert();
      alert.dismiss();

      expect(() => alert.markAsRead()).toThrow(
        'Invalid alert status transition from DISMISSED to READ',
      );
    });
  });

  describe('dismiss', () => {
    it('should transition from UNREAD to DISMISSED', () => {
      const alert = createAlert();

      alert.dismiss();

      expect(alert.status).toBe(AlertStatus.DISMISSED);
    });

    it('should transition from READ to DISMISSED', () => {
      const alert = createAlert();
      alert.markAsRead();

      alert.dismiss();

      expect(alert.status).toBe(AlertStatus.DISMISSED);
    });

    it('should throw when already DISMISSED', () => {
      const alert = createAlert();
      alert.dismiss();

      expect(() => alert.dismiss()).toThrow(
        'Invalid alert status transition from DISMISSED to DISMISSED',
      );
    });

    it('should increment version', () => {
      const alert = createAlert();
      const versionBeforeDismiss = alert.version;

      alert.dismiss();

      expect(alert.version).toBe(versionBeforeDismiss + 1);
    });
  });

  describe('isUnread', () => {
    it('should return true for new alerts', () => {
      const alert = createAlert();
      expect(alert.isUnread()).toBe(true);
    });

    it('should return false after markAsRead', () => {
      const alert = createAlert();
      alert.markAsRead();
      expect(alert.isUnread()).toBe(false);
    });

    it('should return false after dismiss', () => {
      const alert = createAlert();
      alert.dismiss();
      expect(alert.isUnread()).toBe(false);
    });
  });
});
