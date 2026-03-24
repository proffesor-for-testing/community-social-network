import { Inject, Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Block,
  IBlockRepository,
  IConnectionRepository,
} from '@csn/domain-social-graph';
import { BlockMemberCommand } from './block-member.command';
import { BlockResponseDto } from '../dto/block-response.dto';

@Injectable()
export class BlockMemberHandler {
  constructor(
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(command: BlockMemberCommand): Promise<BlockResponseDto> {
    const { blockerId, blockedId } = command;

    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const blockerUserId = UserId.create(blockerId);
    const blockedUserId = UserId.create(blockedId);

    // Check if already blocked
    const existing = await this.blockRepo.findByBlockerAndBlocked(
      blockerUserId,
      blockedUserId,
    );
    if (existing) {
      throw new ConflictException('User is already blocked');
    }

    // Remove any existing connections between the two users
    const connectionAsFollower = await this.connectionRepo.findByFollowerAndFollowee(
      blockerUserId,
      blockedUserId,
    );
    if (connectionAsFollower) {
      await this.connectionRepo.delete(connectionAsFollower);
    }

    const connectionAsFollowee = await this.connectionRepo.findByFollowerAndFollowee(
      blockedUserId,
      blockerUserId,
    );
    if (connectionAsFollowee) {
      await this.connectionRepo.delete(connectionAsFollowee);
    }

    const blockId = this.blockRepo.nextId();
    const block = Block.create(blockId, blockerUserId, blockedUserId);

    await this.blockRepo.save(block);

    return BlockResponseDto.fromDomain(block);
  }
}
