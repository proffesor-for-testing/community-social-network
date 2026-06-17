import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { CurrentUser } from '@csn/infra-auth';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository } from '@csn/domain-social-graph';
import { enrichConnections } from '../queries/enrich-connections';
import { IProfileRepository } from '@csn/domain-profile';
import { FollowMemberCommand } from '../commands/follow-member.command';
import { FollowMemberHandler } from '../commands/follow-member.handler';
import { UnfollowMemberCommand } from '../commands/unfollow-member.command';
import { UnfollowMemberHandler } from '../commands/unfollow-member.handler';
import { ApproveFollowCommand } from '../commands/approve-follow.command';
import { ApproveFollowHandler } from '../commands/approve-follow.handler';
import { RejectFollowCommand } from '../commands/reject-follow.command';
import { RejectFollowHandler } from '../commands/reject-follow.handler';
import { BlockMemberCommand } from '../commands/block-member.command';
import { BlockMemberHandler } from '../commands/block-member.handler';
import { UnblockMemberCommand } from '../commands/unblock-member.command';
import { UnblockMemberHandler } from '../commands/unblock-member.handler';
import { GetBlocksQuery } from '../queries/get-blocks.query';
import { GetBlocksHandler } from '../queries/get-blocks.handler';
import { GetFollowersQuery } from '../queries/get-followers.query';
import { GetFollowersHandler } from '../queries/get-followers.handler';
import { GetFollowingQuery } from '../queries/get-following.query';
import { GetFollowingHandler } from '../queries/get-following.handler';
import { GetPendingRequestsQuery } from '../queries/get-pending-requests.query';
import { GetPendingRequestsHandler } from '../queries/get-pending-requests.handler';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';

class FollowRequestDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;
}

@Controller('api/connections')
export class ConnectionController {
  constructor(
    private readonly followMemberHandler: FollowMemberHandler,
    private readonly unfollowMemberHandler: UnfollowMemberHandler,
    private readonly approveFollowHandler: ApproveFollowHandler,
    private readonly rejectFollowHandler: RejectFollowHandler,
    private readonly blockMemberHandler: BlockMemberHandler,
    private readonly unblockMemberHandler: UnblockMemberHandler,
    private readonly getBlocksHandler: GetBlocksHandler,
    private readonly getFollowersHandler: GetFollowersHandler,
    private readonly getFollowingHandler: GetFollowingHandler,
    private readonly getPendingRequestsHandler: GetPendingRequestsHandler,
    @Inject('IConnectionRepository')
    private readonly connectionRepository: IConnectionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  // ── Query endpoints (most specific first) ──────────────────────
  @Get('pending')
  async getPendingRequests(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<PaginatedConnectionsDto> {
    return this.getPendingRequestsHandler.execute(
      new GetPendingRequestsQuery(currentUserId),
    );
  }

  @Get('blocked')
  async getBlocked(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<unknown[]> {
    return this.getBlocksHandler.execute(new GetBlocksQuery(currentUserId));
  }

  @Get('status/:memberId')
  async getStatus(
    @Param('memberId') memberId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<ConnectionResponseDto> {
    // Look up a direct connection in either direction so the FollowButton
    // can render "Following" / "Pending" / "Follow" without a second round-trip.
    const me = UserId.create(currentUserId);
    const them = UserId.create(memberId);
    const outgoing = await this.connectionRepository.findByFollowerAndFollowee(me, them);
    const incoming = outgoing
      ? null
      : await this.connectionRepository.findByFollowerAndFollowee(them, me);
    const match = outgoing ?? incoming;
    if (!match) {
      throw new NotFoundException('No connection with this member');
    }
    const [enriched] = await enrichConnections([match], this.profileRepository);
    return enriched!;
  }

  @Get(':memberId/followers')
  async getFollowersOf(
    @Param('memberId') memberId: string,
  ): Promise<PaginatedConnectionsDto> {
    return this.getFollowersHandler.execute(new GetFollowersQuery(memberId));
  }

  @Get(':memberId/following')
  async getFollowingOf(
    @Param('memberId') memberId: string,
  ): Promise<PaginatedConnectionsDto> {
    return this.getFollowingHandler.execute(new GetFollowingQuery(memberId));
  }

  // ── Block/unblock ──────────────────────────────────────────────
  @Post('block/:memberId')
  @HttpCode(HttpStatus.CREATED)
  async block(
    @Param('memberId') memberId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<unknown> {
    return this.blockMemberHandler.execute(
      new BlockMemberCommand(currentUserId, memberId),
    );
  }

  @Delete('block/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(
    @Param('memberId') memberId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    return this.unblockMemberHandler.execute(
      new UnblockMemberCommand(currentUserId, memberId),
    );
  }

  // ── Accept/decline pending requests ────────────────────────────
  @Patch(':connectionId/accept')
  async acceptRequest(
    @Param('connectionId') connectionId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<ConnectionResponseDto> {
    return this.approveFollowHandler.execute(
      new ApproveFollowCommand(connectionId, currentUserId),
    );
  }

  @Patch(':connectionId/decline')
  @HttpCode(HttpStatus.OK)
  async declineRequest(
    @Param('connectionId') connectionId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    return this.rejectFollowHandler.execute(
      new RejectFollowCommand(connectionId, currentUserId),
    );
  }

  // ── Follow / unfollow ──────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async follow(
    @Body() dto: FollowRequestDto,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<ConnectionResponseDto> {
    return this.followMemberHandler.execute(
      new FollowMemberCommand(currentUserId, dto.memberId),
    );
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @Param('memberId') memberId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    return this.unfollowMemberHandler.execute(
      new UnfollowMemberCommand(currentUserId, memberId),
    );
  }
}
