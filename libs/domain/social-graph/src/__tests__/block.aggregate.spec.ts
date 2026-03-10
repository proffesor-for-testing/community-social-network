import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Block } from '../aggregates/block';
import { BlockId } from '../value-objects/block-id';
import { MemberBlockedEvent } from '../events/member-blocked.event';
import { MemberUnblockedEvent } from '../events/member-unblocked.event';
import { CannotBlockSelfError } from '../errors/cannot-block-self.error';

describe('Block Aggregate', () => {
  const createBlockId = () => BlockId.generate();
  const createUserId = () => UserId.generate();

  describe('create()', () => {
    it('should create a block', () => {
      const id = createBlockId();
      const blockerId = createUserId();
      const blockedId = createUserId();

      const block = Block.create(id, blockerId, blockedId);

      expect(block.id).toBe(id);
      expect(block.blockerId.equals(blockerId)).toBe(true);
      expect(block.blockedId.equals(blockedId)).toBe(true);
      expect(block.createdAt).toBeDefined();
    });

    it('should emit MemberBlockedEvent on creation', () => {
      const id = createBlockId();
      const blockerId = createUserId();
      const blockedId = createUserId();

      const block = Block.create(id, blockerId, blockedId);
      const events = block.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberBlockedEvent);

      const event = events[0] as MemberBlockedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.blockerId).toBe(blockerId.value);
      expect(event.blockedId).toBe(blockedId.value);
      expect(event.aggregateType).toBe('Block');
      expect(event.eventType).toBe('MemberBlocked');
    });

    it('should throw CannotBlockSelfError when blocker equals blocked', () => {
      const id = createBlockId();
      const userId = createUserId();

      expect(() => Block.create(id, userId, userId)).toThrow(
        CannotBlockSelfError,
      );
    });

    it('should throw CannotBlockSelfError with correct error code', () => {
      const id = createBlockId();
      const userId = createUserId();

      try {
        Block.create(id, userId, userId);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CannotBlockSelfError);
        expect((error as CannotBlockSelfError).code).toBe('CANNOT_BLOCK_SELF');
      }
    });
  });

  describe('unblock()', () => {
    it('should emit MemberUnblockedEvent', () => {
      const id = createBlockId();
      const blockerId = createUserId();
      const blockedId = createUserId();
      const block = Block.create(id, blockerId, blockedId);
      block.pullDomainEvents(); // clear creation event

      block.unblock();
      const events = block.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberUnblockedEvent);

      const event = events[0] as MemberUnblockedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.blockerId).toBe(blockerId.value);
      expect(event.blockedId).toBe(blockedId.value);
      expect(event.aggregateType).toBe('Block');
      expect(event.eventType).toBe('MemberUnblocked');
    });

    it('should increment version on unblock', () => {
      const block = Block.create(
        createBlockId(),
        createUserId(),
        createUserId(),
      );
      expect(block.version).toBe(0);

      block.unblock();

      expect(block.version).toBe(1);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute without emitting events', () => {
      const id = createBlockId();
      const blockerId = createUserId();
      const blockedId = createUserId();

      const block = Block.reconstitute(
        id,
        blockerId,
        blockedId,
        Timestamp.now(),
        3,
      );

      expect(block.pullDomainEvents()).toHaveLength(0);
      expect(block.version).toBe(3);
      expect(block.blockerId.equals(blockerId)).toBe(true);
      expect(block.blockedId.equals(blockedId)).toBe(true);
    });
  });

  describe('entity equality', () => {
    it('should be equal when IDs match', () => {
      const id = createBlockId();
      const block1 = Block.create(id, createUserId(), createUserId());
      const block2 = Block.create(id, createUserId(), createUserId());

      expect(block1.equals(block2)).toBe(true);
    });

    it('should not be equal when IDs differ', () => {
      const blockerId = createUserId();
      const blockedId = createUserId();
      const block1 = Block.create(createBlockId(), blockerId, blockedId);
      const block2 = Block.create(createBlockId(), blockerId, blockedId);

      expect(block1.equals(block2)).toBe(false);
    });
  });
});
