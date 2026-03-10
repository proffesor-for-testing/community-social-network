import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  ConnectionStatus,
  ConnectionStatusEnum,
} from '@csn/domain-social-graph';
import { ConnectionMapper } from '../mappers/connection.mapper';
import { ConnectionEntity } from '../entities/connection.entity';

describe('ConnectionMapper', () => {
  const mapper = new ConnectionMapper();

  const createEntity = (overrides?: Partial<ConnectionEntity>): ConnectionEntity => {
    const entity = new ConnectionEntity();
    entity.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    entity.followerId = '11111111-1111-1111-1111-111111111111';
    entity.followeeId = '22222222-2222-2222-2222-222222222222';
    entity.status = ConnectionStatusEnum.PENDING;
    entity.createdAt = new Date('2025-01-15T10:00:00.000Z');
    entity.updatedAt = new Date('2025-01-15T10:00:00.000Z');
    entity.version = 1;
    Object.assign(entity, overrides);
    return entity;
  };

  const createDomain = (): Connection => {
    return Connection.reconstitute(
      ConnectionId.create('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      UserId.create('11111111-1111-1111-1111-111111111111'),
      UserId.create('22222222-2222-2222-2222-222222222222'),
      ConnectionStatus.pending(),
      Timestamp.fromDate(new Date('2025-01-15T10:00:00.000Z')),
      1,
    );
  };

  describe('toDomain()', () => {
    it('should map entity to domain aggregate', () => {
      const entity = createEntity();

      const domain = mapper.toDomain(entity);

      expect(domain.id.value).toBe(entity.id);
      expect(domain.followerId.value).toBe(entity.followerId);
      expect(domain.followeeId.value).toBe(entity.followeeId);
      expect(domain.status.value).toBe(entity.status);
      expect(domain.createdAt.value.getTime()).toBe(entity.createdAt.getTime());
      expect(domain.version).toBe(entity.version);
    });

    it('should map ACCEPTED status correctly', () => {
      const entity = createEntity({ status: ConnectionStatusEnum.ACCEPTED });

      const domain = mapper.toDomain(entity);

      expect(domain.status.value).toBe(ConnectionStatusEnum.ACCEPTED);
    });

    it('should map REJECTED status correctly', () => {
      const entity = createEntity({ status: ConnectionStatusEnum.REJECTED });

      const domain = mapper.toDomain(entity);

      expect(domain.status.value).toBe(ConnectionStatusEnum.REJECTED);
    });

    it('should not emit domain events on reconstitution', () => {
      const entity = createEntity();

      const domain = mapper.toDomain(entity);

      expect(domain.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('toPersistence()', () => {
    it('should map domain aggregate to entity', () => {
      const domain = createDomain();

      const entity = mapper.toPersistence(domain);

      expect(entity.id).toBe(domain.id.value);
      expect(entity.followerId).toBe(domain.followerId.value);
      expect(entity.followeeId).toBe(domain.followeeId.value);
      expect(entity.status).toBe(domain.status.value);
      expect(entity.createdAt.getTime()).toBe(domain.createdAt.value.getTime());
      expect(entity.version).toBe(domain.version);
    });

    it('should set updatedAt to a recent Date', () => {
      const domain = createDomain();
      const before = Date.now();

      const entity = mapper.toPersistence(domain);

      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toPersistence -> toDomain', () => {
      const original = createDomain();

      const entity = mapper.toPersistence(original);
      const roundTripped = mapper.toDomain(entity);

      expect(roundTripped.id.value).toBe(original.id.value);
      expect(roundTripped.followerId.value).toBe(original.followerId.value);
      expect(roundTripped.followeeId.value).toBe(original.followeeId.value);
      expect(roundTripped.status.value).toBe(original.status.value);
      expect(roundTripped.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(roundTripped.version).toBe(original.version);
    });

    it('should preserve data through toDomain -> toPersistence', () => {
      const original = createEntity();

      const domain = mapper.toDomain(original);
      const roundTripped = mapper.toPersistence(domain);

      expect(roundTripped.id).toBe(original.id);
      expect(roundTripped.followerId).toBe(original.followerId);
      expect(roundTripped.followeeId).toBe(original.followeeId);
      expect(roundTripped.status).toBe(original.status);
      expect(roundTripped.createdAt.getTime()).toBe(
        original.createdAt.getTime(),
      );
      expect(roundTripped.version).toBe(original.version);
    });
  });
});
