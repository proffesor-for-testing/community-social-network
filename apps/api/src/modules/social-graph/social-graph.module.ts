import { Module } from '@nestjs/common';
import { SocialGraphInfrastructureModule } from '@csn/infra-social-graph';

// Controllers
import { ConnectionController } from './controllers/connection.controller';
import { BlockController } from './controllers/block.controller';

// Command handlers
import { FollowMemberHandler } from './commands/follow-member.handler';
import { UnfollowMemberHandler } from './commands/unfollow-member.handler';
import { ApproveFollowHandler } from './commands/approve-follow.handler';
import { RejectFollowHandler } from './commands/reject-follow.handler';
import { BlockMemberHandler } from './commands/block-member.handler';
import { UnblockMemberHandler } from './commands/unblock-member.handler';

// Query handlers
import { GetFollowersHandler } from './queries/get-followers.handler';
import { GetFollowingHandler } from './queries/get-following.handler';
import { GetPendingRequestsHandler } from './queries/get-pending-requests.handler';
import { GetBlocksHandler } from './queries/get-blocks.handler';

@Module({
  imports: [SocialGraphInfrastructureModule],
  controllers: [ConnectionController, BlockController],
  providers: [
    // Command handlers
    FollowMemberHandler,
    UnfollowMemberHandler,
    ApproveFollowHandler,
    RejectFollowHandler,
    BlockMemberHandler,
    UnblockMemberHandler,

    // Query handlers
    GetFollowersHandler,
    GetFollowingHandler,
    GetPendingRequestsHandler,
    GetBlocksHandler,
  ],
})
export class SocialGraphModule {}
