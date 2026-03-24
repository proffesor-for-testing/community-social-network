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
import { FollowMemberCommand } from '../commands/follow-member.command';
import { FollowMemberHandler } from '../commands/follow-member.handler';
import { UnfollowMemberCommand } from '../commands/unfollow-member.command';
import { UnfollowMemberHandler } from '../commands/unfollow-member.handler';
import { ApproveFollowCommand } from '../commands/approve-follow.command';
import { ApproveFollowHandler } from '../commands/approve-follow.handler';
import { RejectFollowCommand } from '../commands/reject-follow.command';
import { RejectFollowHandler } from '../commands/reject-follow.handler';
import { GetFollowersQuery } from '../queries/get-followers.query';
import { GetFollowersHandler } from '../queries/get-followers.handler';
import { GetFollowingQuery } from '../queries/get-following.query';
import { GetFollowingHandler } from '../queries/get-following.handler';
import { GetPendingRequestsQuery } from '../queries/get-pending-requests.query';
import { GetPendingRequestsHandler } from '../queries/get-pending-requests.handler';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';

@Controller('api/connections')
export class ConnectionController {
  constructor(
    private readonly followMemberHandler: FollowMemberHandler,
    private readonly unfollowMemberHandler: UnfollowMemberHandler,
    private readonly approveFollowHandler: ApproveFollowHandler,
    private readonly rejectFollowHandler: RejectFollowHandler,
    private readonly getFollowersHandler: GetFollowersHandler,
    private readonly getFollowingHandler: GetFollowingHandler,
    private readonly getPendingRequestsHandler: GetPendingRequestsHandler,
  ) {}

  @Post('follow/:userId')
  @HttpCode(HttpStatus.CREATED)
  async follow(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<ConnectionResponseDto> {
    const command = new FollowMemberCommand(currentUserId, userId);
    return this.followMemberHandler.execute(command);
  }

  @Delete('follow/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    const command = new UnfollowMemberCommand(currentUserId, userId);
    return this.unfollowMemberHandler.execute(command);
  }

  @Post('approve/:connectionId')
  @HttpCode(HttpStatus.OK)
  async approveFollow(
    @Param('connectionId') connectionId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<ConnectionResponseDto> {
    const command = new ApproveFollowCommand(connectionId, currentUserId);
    return this.approveFollowHandler.execute(command);
  }

  @Post('reject/:connectionId')
  @HttpCode(HttpStatus.OK)
  async rejectFollow(
    @Param('connectionId') connectionId: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    const command = new RejectFollowCommand(connectionId, currentUserId);
    return this.rejectFollowHandler.execute(command);
  }

  @Get('followers')
  @HttpCode(HttpStatus.OK)
  async getFollowers(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<PaginatedConnectionsDto> {
    const query = new GetFollowersQuery(currentUserId);
    return this.getFollowersHandler.execute(query);
  }

  @Get('following')
  @HttpCode(HttpStatus.OK)
  async getFollowing(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<PaginatedConnectionsDto> {
    const query = new GetFollowingQuery(currentUserId);
    return this.getFollowingHandler.execute(query);
  }

  @Get('pending')
  @HttpCode(HttpStatus.OK)
  async getPendingRequests(
    @CurrentUser('userId') currentUserId: string,
  ): Promise<PaginatedConnectionsDto> {
    const query = new GetPendingRequestsQuery(currentUserId);
    return this.getPendingRequestsHandler.execute(query);
  }
}
