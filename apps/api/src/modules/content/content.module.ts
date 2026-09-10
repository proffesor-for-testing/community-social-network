import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentInfrastructureModule, ReactionEntity } from '@csn/infra-content';
import { ViewerReactionService } from './services/viewer-reaction.service';
import { ProfileInfrastructureModule } from '@csn/infra-profile';
import { NotificationModule } from '../notification/notification.module';

import { PostController } from './controllers/post.controller';
import { CommentController } from './controllers/comment.controller';
import { ReactionController } from './controllers/reaction.controller';

import { CreatePostHandler } from './commands/create-post.handler';
import { UpdatePostHandler } from './commands/update-post.handler';
import { DeletePostHandler } from './commands/delete-post.handler';
import { CreateCommentHandler } from './commands/create-comment.handler';
import { DeleteCommentHandler } from './commands/delete-comment.handler';
import { UpdateCommentHandler } from './commands/update-comment.handler';
import { AddReactionHandler } from './commands/add-reaction.handler';
import { RemoveReactionHandler } from './commands/remove-reaction.handler';

import { GetPostHandler } from './queries/get-post.handler';
import { GetFeedHandler } from './queries/get-feed.handler';
import { GetCommentsHandler } from './queries/get-comments.handler';

const CommandHandlers = [
  CreatePostHandler,
  UpdatePostHandler,
  DeletePostHandler,
  CreateCommentHandler,
  DeleteCommentHandler,
  UpdateCommentHandler,
  AddReactionHandler,
  RemoveReactionHandler,
];

const QueryHandlers = [
  GetPostHandler,
  GetFeedHandler,
  GetCommentsHandler,
];

@Module({
  imports: [
    CqrsModule,
    ContentInfrastructureModule,
    ProfileInfrastructureModule,
    NotificationModule,
    TypeOrmModule.forFeature([ReactionEntity]),
  ],
  controllers: [PostController, CommentController, ReactionController],
  providers: [...CommandHandlers, ...QueryHandlers, ViewerReactionService],
})
export class ContentModule {}
