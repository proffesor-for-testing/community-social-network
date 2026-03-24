import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '@csn/infra-auth';
import { BlockMemberCommand } from '../commands/block-member.command';
import { BlockMemberHandler } from '../commands/block-member.handler';
import { UnblockMemberCommand } from '../commands/unblock-member.command';
import { UnblockMemberHandler } from '../commands/unblock-member.handler';
import { GetBlocksQuery } from '../queries/get-blocks.query';
import { GetBlocksHandler } from '../queries/get-blocks.handler';
import { BlockResponseDto } from '../dto/block-response.dto';

@Controller('api/blocks')
export class BlockController {
  constructor(
    private readonly blockMemberHandler: BlockMemberHandler,
    private readonly unblockMemberHandler: UnblockMemberHandler,
    private readonly getBlocksHandler: GetBlocksHandler,
  ) {}

  @Post(':userId')
  @HttpCode(HttpStatus.CREATED)
  async block(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<BlockResponseDto> {
    const command = new BlockMemberCommand(currentUserId, userId);
    return this.blockMemberHandler.execute(command);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    const command = new UnblockMemberCommand(currentUserId, userId);
    return this.unblockMemberHandler.execute(command);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getBlocks(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<BlockResponseDto[]> {
    const query = new GetBlocksQuery(currentUserId);
    return this.getBlocksHandler.execute(query);
  }
}
