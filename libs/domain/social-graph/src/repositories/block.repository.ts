import { IRepository, UserId } from '@csn/domain-shared';
import { Block } from '../aggregates/block';
import { BlockId } from '../value-objects/block-id';

export interface IBlockRepository extends IRepository<Block, BlockId> {
  findByBlockerAndBlocked(
    blockerId: UserId,
    blockedId: UserId,
  ): Promise<Block | null>;

  findByBlocker(blockerId: UserId): Promise<Block[]>;

  isBlocked(userId1: UserId, userId2: UserId): Promise<boolean>;
}
