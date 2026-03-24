import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IBlockRepository } from '@csn/domain-social-graph';
import { UnblockMemberCommand } from './unblock-member.command';

@Injectable()
export class UnblockMemberHandler {
  constructor(
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
  ) {}

  async execute(command: UnblockMemberCommand): Promise<void> {
    const { blockerId, blockedId } = command;

    const blockerUserId = UserId.create(blockerId);
    const blockedUserId = UserId.create(blockedId);

    const block = await this.blockRepo.findByBlockerAndBlocked(
      blockerUserId,
      blockedUserId,
    );

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    block.unblock();
    await this.blockRepo.delete(block);
  }
}
