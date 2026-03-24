import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { Block, BlockId, IBlockRepository } from '@csn/domain-social-graph';
import { BlockMapper } from '../mappers/block.mapper';
import { BlockEntity } from '../entities/block.entity';

export class InMemoryBlockRepository implements IBlockRepository {
  private readonly store = new Map<string, BlockEntity>();
  private readonly mapper = new BlockMapper();

  nextId(): BlockId {
    return BlockId.create(randomUUID());
  }

  async findById(id: BlockId): Promise<Block | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: BlockId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Block): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(entity.id, entity);
  }

  async delete(aggregate: Block): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByBlocker(blockerId: UserId): Promise<Block[]> {
    const results: Block[] = [];
    for (const entity of this.store.values()) {
      if (entity.blockerId === blockerId.value) {
        results.push(this.mapper.toDomain(entity));
      }
    }
    return results;
  }

  async findByBlockerAndBlocked(
    blockerId: UserId,
    blockedId: UserId,
  ): Promise<Block | null> {
    for (const entity of this.store.values()) {
      if (
        entity.blockerId === blockerId.value &&
        entity.blockedId === blockedId.value
      ) {
        return this.mapper.toDomain(entity);
      }
    }
    return null;
  }

  async isBlocked(userId1: UserId, userId2: UserId): Promise<boolean> {
    for (const entity of this.store.values()) {
      if (
        (entity.blockerId === userId1.value &&
          entity.blockedId === userId2.value) ||
        (entity.blockerId === userId2.value &&
          entity.blockedId === userId1.value)
      ) {
        return true;
      }
    }
    return false;
  }

  /** Test helper: clear all stored entities. */
  clear(): void {
    this.store.clear();
  }
}
