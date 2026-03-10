import { AggregateMapper } from '@csn/infra-shared';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Block, BlockId } from '@csn/domain-social-graph';
import { BlockEntity } from '../entities/block.entity';

export class BlockMapper implements AggregateMapper<Block, BlockEntity> {
  toDomain(raw: BlockEntity): Block {
    return Block.reconstitute(
      BlockId.create(raw.id),
      UserId.create(raw.blockerId),
      UserId.create(raw.blockedId),
      Timestamp.fromDate(raw.createdAt),
      raw.version,
    );
  }

  toPersistence(domain: Block): BlockEntity {
    const entity = new BlockEntity();
    entity.id = domain.id.value;
    entity.blockerId = domain.blockerId.value;
    entity.blockedId = domain.blockedId.value;
    entity.reason = null;
    entity.createdAt = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}
