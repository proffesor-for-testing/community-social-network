import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ContentInfrastructureModule } from '@csn/infra-content';

import { PostController } from './controllers/post.controller';
import { CommentController } from './controllers/comment.controller';
import { ReactionController } from './controllers/reaction.controller';

import { CreatePostHandler } from './commands/create-post.handler';
import { UpdatePostHandler } from './commands/update-post.handler';
import { DeletePostHandler } from './commands/delete-post.handler';
import { CreateCommentHandler } from './commands/create-comment.handler';
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
  AddReactionHandler,
  RemoveReactionHandler,
];

const QueryHandlers = [
  GetPostHandler,
  GetFeedHandler,
  GetCommentsHandler,
];

@Module({
  imports: [CqrsModule, ContentInfrastructureModule],
  controllers: [PostController, CommentController, ReactionController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class ContentModule {}
