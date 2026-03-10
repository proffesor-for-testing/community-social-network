import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Block, BlockId } from '@csn/domain-social-graph';
import { BlockMapper } from '../mappers/block.mapper';
import { BlockEntity } from '../entities/block.entity';

describe('BlockMapper', () => {
  const mapper = new BlockMapper();

  const createEntity = (overrides?: Partial<BlockEntity>): BlockEntity => {
    const entity = new BlockEntity();
    entity.id = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
    entity.blockerId = '33333333-3333-3333-3333-333333333333';
    entity.blockedId = '44444444-4444-4444-4444-444444444444';
    entity.reason = null;
    entity.createdAt = new Date('2025-02-20T14:30:00.000Z');
    entity.version = 2;
    Object.assign(entity, overrides);
    return entity;
  };

  const createDomain = (): Block => {
    return Block.reconstitute(
      BlockId.create('b1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      UserId.create('33333333-3333-3333-3333-333333333333'),
      UserId.create('44444444-4444-4444-4444-444444444444'),
      Timestamp.fromDate(new Date('2025-02-20T14:30:00.000Z')),
      2,
    );
  };

  describe('toDomain()', () => {
    it('should map entity to domain aggregate', () => {
      const entity = createEntity();

      const domain = mapper.toDomain(entity);

      expect(domain.id.value).toBe(entity.id);
      expect(domain.blockerId.value).toBe(entity.blockerId);
      expect(domain.blockedId.value).toBe(entity.blockedId);
      expect(domain.createdAt.value.getTime()).toBe(entity.createdAt.getTime());
      expect(domain.version).toBe(entity.version);
    });

    it('should not emit domain events on reconstitution', () => {
      const entity = createEntity();

      const domain = mapper.toDomain(entity);

      expect(domain.pullDomainEvents()).toHaveLength(0);
    });

    it('should handle entity with a non-null reason', () => {
      const entity = createEntity({ reason: 'Harassment' });

      const domain = mapper.toDomain(entity);

      expect(domain.id.value).toBe(entity.id);
      expect(domain.blockerId.value).toBe(entity.blockerId);
    });
  });

  describe('toPersistence()', () => {
    it('should map domain aggregate to entity', () => {
      const domain = createDomain();

      const entity = mapper.toPersistence(domain);

      expect(entity.id).toBe(domain.id.value);
      expect(entity.blockerId).toBe(domain.blockerId.value);
      expect(entity.blockedId).toBe(domain.blockedId.value);
      expect(entity.reason).toBeNull();
      expect(entity.createdAt.getTime()).toBe(domain.createdAt.value.getTime());
      expect(entity.version).toBe(domain.version);
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toPersistence -> toDomain', () => {
      const original = createDomain();

      const entity = mapper.toPersistence(original);
      const roundTripped = mapper.toDomain(entity);

      expect(roundTripped.id.value).toBe(original.id.value);
      expect(roundTripped.blockerId.value).toBe(original.blockerId.value);
      expect(roundTripped.blockedId.value).toBe(original.blockedId.value);
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
      expect(roundTripped.blockerId).toBe(original.blockerId);
      expect(roundTripped.blockedId).toBe(original.blockedId);
      expect(roundTripped.createdAt.getTime()).toBe(
        original.createdAt.getTime(),
      );
      expect(roundTripped.version).toBe(original.version);
    });
  });
});
