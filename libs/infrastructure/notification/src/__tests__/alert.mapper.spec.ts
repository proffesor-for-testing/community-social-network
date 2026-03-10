import { describe, it, expect } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
  AlertStatus,
} from '@csn/domain-notification';
import { AlertMapper } from '../mappers/alert.mapper';
import { AlertEntity } from '../entities/alert.entity';

describe('AlertMapper', () => {
  const mapper = new AlertMapper();

  const createDomainAlert = () => {
    const id = AlertId.generate();
    const recipientId = UserId.generate();
    const content = AlertContent.create(
      'New follower',
      'John started following you',
      '/profile/john',
    );
    return Alert.create(id, recipientId, AlertType.FOLLOW, content, 'source-123');
  };

  const createEntity = (overrides: Partial<AlertEntity> = {}): AlertEntity => {
    const entity = new AlertEntity();
    entity.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    entity.recipientId = 'f1e2d3c4-b5a6-7890-abcd-ef1234567890';
    entity.type = AlertType.LIKE;
    entity.title = 'New like';
    entity.body = 'Someone liked your post';
    entity.actionUrl = '/posts/42';
    entity.status = AlertStatus.UNREAD;
    entity.referenceId = 'post-42';
    entity.createdAt = new Date('2025-06-15T12:00:00.000Z');
    entity.readAt = null;
    entity.dismissedAt = null;
    entity.version = 1;
    Object.assign(entity, overrides);
    return entity;
  };

  describe('toPersistence', () => {
    it('should map all domain fields to entity columns', () => {
      const alert = createDomainAlert();
      const entity = mapper.toPersistence(alert);

      expect(entity.id).toBe(alert.id.value);
      expect(entity.recipientId).toBe(alert.recipientId.value);
      expect(entity.type).toBe(AlertType.FOLLOW);
      expect(entity.title).toBe('New follower');
      expect(entity.body).toBe('John started following you');
      expect(entity.actionUrl).toBe('/profile/john');
      expect(entity.status).toBe(AlertStatus.UNREAD);
      expect(entity.referenceId).toBe('source-123');
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.readAt).toBeNull();
      expect(entity.dismissedAt).toBeNull();
      expect(entity.version).toBe(1);
    });

    it('should set actionUrl to null when not provided', () => {
      const id = AlertId.generate();
      const recipientId = UserId.generate();
      const content = AlertContent.create('Title', 'Body');
      const alert = Alert.create(id, recipientId, AlertType.COMMENT, content, 'src-1');

      const entity = mapper.toPersistence(alert);

      expect(entity.actionUrl).toBeNull();
    });

    it('should set dismissedAt when status is DISMISSED', () => {
      const alert = createDomainAlert();
      alert.dismiss();

      const entity = mapper.toPersistence(alert);

      expect(entity.status).toBe(AlertStatus.DISMISSED);
      expect(entity.dismissedAt).toBeInstanceOf(Date);
    });

    it('should set readAt when alert is read', () => {
      const alert = createDomainAlert();
      alert.markAsRead();

      const entity = mapper.toPersistence(alert);

      expect(entity.status).toBe(AlertStatus.READ);
      expect(entity.readAt).toBeInstanceOf(Date);
    });
  });

  describe('toDomain', () => {
    it('should map all entity columns to domain fields', () => {
      const entity = createEntity();
      const alert = mapper.toDomain(entity);

      expect(alert.id.value).toBe(entity.id);
      expect(alert.recipientId.value).toBe(entity.recipientId);
      expect(alert.type).toBe(AlertType.LIKE);
      expect(alert.content.title).toBe('New like');
      expect(alert.content.body).toBe('Someone liked your post');
      expect(alert.content.actionUrl).toBe('/posts/42');
      expect(alert.status).toBe(AlertStatus.UNREAD);
      expect(alert.sourceId).toBe('post-42');
      expect(alert.createdAt.value.toISOString()).toBe('2025-06-15T12:00:00.000Z');
      expect(alert.readAt).toBeNull();
      expect(alert.version).toBe(1);
    });

    it('should handle null actionUrl', () => {
      const entity = createEntity({ actionUrl: null });
      const alert = mapper.toDomain(entity);

      expect(alert.content.actionUrl).toBeUndefined();
    });

    it('should handle READ status with readAt timestamp', () => {
      const readDate = new Date('2025-06-15T13:00:00.000Z');
      const entity = createEntity({
        status: AlertStatus.READ,
        readAt: readDate,
      });

      const alert = mapper.toDomain(entity);

      expect(alert.status).toBe(AlertStatus.READ);
      expect(alert.readAt).not.toBeNull();
      expect(alert.readAt!.value.toISOString()).toBe('2025-06-15T13:00:00.000Z');
    });

    it('should handle null referenceId', () => {
      const entity = createEntity({ referenceId: null });
      const alert = mapper.toDomain(entity);

      expect(alert.sourceId).toBe('');
    });

    it('should start with no pending domain events', () => {
      const entity = createEntity();
      const alert = mapper.toDomain(entity);

      expect(alert.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve all data through domain -> entity -> domain', () => {
      const original = createDomainAlert();
      // Clear events from creation
      original.pullDomainEvents();

      const entity = mapper.toPersistence(original);
      const reconstituted = mapper.toDomain(entity);

      expect(reconstituted.id.value).toBe(original.id.value);
      expect(reconstituted.recipientId.value).toBe(original.recipientId.value);
      expect(reconstituted.type).toBe(original.type);
      expect(reconstituted.content.title).toBe(original.content.title);
      expect(reconstituted.content.body).toBe(original.content.body);
      expect(reconstituted.content.actionUrl).toBe(original.content.actionUrl);
      expect(reconstituted.status).toBe(original.status);
      expect(reconstituted.sourceId).toBe(original.sourceId);
      expect(reconstituted.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(reconstituted.readAt).toBeNull();
      expect(reconstituted.version).toBe(original.version);
    });

    it('should preserve READ status through round-trip', () => {
      const original = createDomainAlert();
      original.markAsRead();
      original.pullDomainEvents();

      const entity = mapper.toPersistence(original);
      const reconstituted = mapper.toDomain(entity);

      expect(reconstituted.status).toBe(AlertStatus.READ);
      expect(reconstituted.readAt).not.toBeNull();
      expect(reconstituted.readAt!.value.getTime()).toBe(
        original.readAt!.value.getTime(),
      );
      expect(reconstituted.version).toBe(original.version);
    });

    it('should preserve data through entity -> domain -> entity', () => {
      const originalEntity = createEntity();
      const domain = mapper.toDomain(originalEntity);
      const roundTrippedEntity = mapper.toPersistence(domain);

      expect(roundTrippedEntity.id).toBe(originalEntity.id);
      expect(roundTrippedEntity.recipientId).toBe(originalEntity.recipientId);
      expect(roundTrippedEntity.type).toBe(originalEntity.type);
      expect(roundTrippedEntity.title).toBe(originalEntity.title);
      expect(roundTrippedEntity.body).toBe(originalEntity.body);
      expect(roundTrippedEntity.actionUrl).toBe(originalEntity.actionUrl);
      expect(roundTrippedEntity.status).toBe(originalEntity.status);
      expect(roundTrippedEntity.referenceId).toBe(originalEntity.referenceId);
      expect(roundTrippedEntity.createdAt.getTime()).toBe(
        originalEntity.createdAt.getTime(),
      );
      expect(roundTrippedEntity.readAt).toBeNull();
      expect(roundTrippedEntity.version).toBe(originalEntity.version);
    });
  });
});
