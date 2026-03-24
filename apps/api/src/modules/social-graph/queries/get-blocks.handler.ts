import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IBlockRepository } from '@csn/domain-social-graph';
import { GetBlocksQuery } from './get-blocks.query';
import { BlockResponseDto } from '../dto/block-response.dto';

@Injectable()
export class GetBlocksHandler {
  constructor(
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
  ) {}

  async execute(query: GetBlocksQuery): Promise<BlockResponseDto[]> {
    const userId = UserId.create(query.userId);

    const blocks = await this.blockRepo.findByBlocker(userId);

    return blocks.map(BlockResponseDto.fromDomain);
  }
}
