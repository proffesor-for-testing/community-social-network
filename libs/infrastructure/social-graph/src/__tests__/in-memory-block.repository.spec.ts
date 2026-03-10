import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import { Block, BlockId } from '@csn/domain-social-graph';
import { InMemoryBlockRepository } from '../repositories/in-memory-block.repository';

describe('InMemoryBlockRepository', () => {
  let repository: InMemoryBlockRepository;

  beforeEach(() => {
    repository = new InMemoryBlockRepository();
  });

  const createBlock = (
    blockerId?: UserId,
    blockedId?: UserId,
  ): Block => {
    const id = repository.nextId();
    return Block.create(
      id,
      blockerId ?? UserId.generate(),
      blockedId ?? UserId.generate(),
    );
  };

  describe('nextId()', () => {
    it('should generate a unique BlockId', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
    });

    it('should return a valid BlockId', () => {
      const id = repository.nextId();

      expect(id).toBeInstanceOf(BlockId);
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('save() and findById()', () => {
    it('should save and retrieve a block', async () => {
      const block = createBlock();

      await repository.save(block);
      const found = await repository.findById(block.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(block.id.value);
      expect(found!.blockerId.value).toBe(block.blockerId.value);
      expect(found!.blockedId.value).toBe(block.blockedId.value);
    });

    it('should return null for non-existent id', async () => {
      const id = BlockId.generate();

      const found = await repository.findById(id);

      expect(found).toBeNull();
    });
  });

  describe('exists()', () => {
    it('should return true for existing block', async () => {
      const block = createBlock();
      await repository.save(block);

      const result = await repository.exists(block.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent block', async () => {
      const result = await repository.exists(BlockId.generate());

      expect(result).toBe(false);
    });
  });

  describe('delete()', () => {
    it('should remove a block', async () => {
      const block = createBlock();
      await repository.save(block);

      await repository.delete(block);

      const found = await repository.findById(block.id);
      expect(found).toBeNull();
    });
  });

  describe('findByBlockerAndBlocked()', () => {
    it('should find block by blocker and blocked', async () => {
      const blockerId = UserId.generate();
      const blockedId = UserId.generate();
      const block = createBlock(blockerId, blockedId);
      await repository.save(block);

      const found = await repository.findByBlockerAndBlocked(
        blockerId,
        blockedId,
      );

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(block.id.value);
    });

    it('should return null when no matching block', async () => {
      const found = await repository.findByBlockerAndBlocked(
        UserId.generate(),
        UserId.generate(),
      );

      expect(found).toBeNull();
    });

    it('should not match reversed blocker/blocked', async () => {
      const blockerId = UserId.generate();
      const blockedId = UserId.generate();
      const block = createBlock(blockerId, blockedId);
      await repository.save(block);

      const found = await repository.findByBlockerAndBlocked(
        blockedId,
        blockerId,
      );

      expect(found).toBeNull();
    });
  });

  describe('isBlocked()', () => {
    it('should return true when user1 has blocked user2', async () => {
      const user1 = UserId.generate();
      const user2 = UserId.generate();
      await repository.save(createBlock(user1, user2));

      const result = await repository.isBlocked(user1, user2);

      expect(result).toBe(true);
    });

    it('should return true when user2 has blocked user1 (bidirectional check)', async () => {
      const user1 = UserId.generate();
      const user2 = UserId.generate();
      await repository.save(createBlock(user2, user1));

      const result = await repository.isBlocked(user1, user2);

      expect(result).toBe(true);
    });

    it('should return false when no block exists between users', async () => {
      const result = await repository.isBlocked(
        UserId.generate(),
        UserId.generate(),
      );

      expect(result).toBe(false);
    });

    it('should return false when block exists with unrelated users', async () => {
      const user1 = UserId.generate();
      const user2 = UserId.generate();
      const unrelated = UserId.generate();
      await repository.save(createBlock(user1, unrelated));

      const result = await repository.isBlocked(user1, user2);

      expect(result).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all stored entities', async () => {
      await repository.save(createBlock());
      await repository.save(createBlock());

      repository.clear();

      const result = await repository.isBlocked(
        UserId.generate(),
        UserId.generate(),
      );
      expect(result).toBe(false);
    });
  });
});
