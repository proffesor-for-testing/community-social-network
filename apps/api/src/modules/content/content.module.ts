import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentInfrastructureModule, ReactionEntity } from '@csn/infra-content';
import { ViewerReactionService } from './services/viewer-reaction.service';
import { ProfileInfrastructureModule } from '@csn/infra-profile';
import { SocialGraphInfrastructureModule } from '@csn/infra-social-graph';
import { CommunityInfrastructureModule } from '@csn/infra-community';
import { NotificationModule } from '../notification/notification.module';

import { PostController } from './controllers/post.controller';
import { CommentController } from './controllers/comment.controller';
import { ReactionController } from './controllers/reaction.controller';
import { GroupPublicationController } from './controllers/group-publication.controller';

import { CreatePostHandler } from './commands/create-post.handler';
import { UpdatePostHandler } from './commands/update-post.handler';
import { DeletePostHandler } from './commands/delete-post.handler';
import { CreateCommentHandler } from './commands/create-comment.handler';
import { DeleteCommentHandler } from './commands/delete-comment.handler';
import { UpdateCommentHandler } from './commands/update-comment.handler';
import { AddReactionHandler } from './commands/add-reaction.handler';
import { CreateGroupPostHandler } from './commands/create-group-post.handler';
import { RemoveReactionHandler } from './commands/remove-reaction.handler';

import { GetPostHandler } from './queries/get-post.handler';
import { GetFeedHandler } from './queries/get-feed.handler';
import { GetCommentsHandler } from './queries/get-comments.handler';
import { GetExploreFeedHandler } from './queries/get-explore-feed.handler';
import { GetGroupFeedHandler } from './queries/get-group-feed.handler';
import { GroupMembershipChecker } from './services/group-membership-checker.service';

const CommandHandlers = [
  CreatePostHandler,
  UpdatePostHandler,
  DeletePostHandler,
  CreateCommentHandler,
  DeleteCommentHandler,
  UpdateCommentHandler,
  AddReactionHandler,
  RemoveReactionHandler,
  CreateGroupPostHandler,
];

const QueryHandlers = [
  GetPostHandler,
  GetFeedHandler,
  GetCommentsHandler,
  GetExploreFeedHandler,
  GetGroupFeedHandler,
];

@Module({
  imports: [
    CqrsModule,
    ContentInfrastructureModule,
    ProfileInfrastructureModule,
    SocialGraphInfrastructureModule,
    CommunityInfrastructureModule,
    NotificationModule,
    TypeOrmModule.forFeature([ReactionEntity]),
  ],
  controllers: [
    PostController,
    CommentController,
    ReactionController,
    GroupPublicationController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ViewerReactionService,
    GroupMembershipChecker,
  ],
})
export class ContentModule {}
