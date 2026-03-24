import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere } from 'typeorm';
import { BaseRepository } from '@csn/infra-shared';
import { UserId } from '@csn/domain-shared';
import { Block, BlockId, IBlockRepository } from '@csn/domain-social-graph';
import { BlockEntity } from '../entities/block.entity';
import { BlockMapper } from '../mappers/block.mapper';

export class PostgresBlockRepository
  extends BaseRepository<Block, BlockId, BlockEntity>
  implements IBlockRepository
{
  constructor(ormRepository: Repository<BlockEntity>) {
    super(ormRepository, new BlockMapper());
  }

  nextId(): BlockId {
    return BlockId.create(randomUUID());
  }

  protected idCondition(id: BlockId): FindOptionsWhere<BlockEntity> {
    return { id: id.value } as FindOptionsWhere<BlockEntity>;
  }

  async findByBlocker(blockerId: UserId): Promise<Block[]> {
    const entities = await this.ormRepository.find({
      where: {
        blockerId: blockerId.value,
      } as FindOptionsWhere<BlockEntity>,
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findByBlockerAndBlocked(
    blockerId: UserId,
    blockedId: UserId,
  ): Promise<Block | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        blockerId: blockerId.value,
        blockedId: blockedId.value,
      } as FindOptionsWhere<BlockEntity>,
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async isBlocked(userId1: UserId, userId2: UserId): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: [
        {
          blockerId: userId1.value,
          blockedId: userId2.value,
        } as FindOptionsWhere<BlockEntity>,
        {
          blockerId: userId2.value,
          blockedId: userId1.value,
        } as FindOptionsWhere<BlockEntity>,
      ],
    });
    return count > 0;
  }
}
