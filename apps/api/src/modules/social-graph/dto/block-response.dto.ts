import { Block } from '@csn/domain-social-graph';

export class BlockResponseDto {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;

  public static fromDomain(block: Block): BlockResponseDto {
    const dto = new BlockResponseDto();
    dto.id = block.id.value;
    dto.blockerId = block.blockerId.value;
    dto.blockedId = block.blockedId.value;
    dto.createdAt = block.createdAt.value.toISOString();
    return dto;
  }
}
